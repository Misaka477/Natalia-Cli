package networkpolicy

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

type Config struct {
	AllowedHosts   []string
	AllowedCIDRs   []string
	AllowedSchemes []string
	AllowLocalhost bool
	AllowPrivate   bool
}

type Policy struct {
	allowedHosts   map[string]bool
	allowedCIDRs   []*net.IPNet
	allowedSchemes map[string]bool
	allowLocalhost bool
	allowPrivate   bool
}

func New(cfg Config) (*Policy, error) {
	p := &Policy{
		allowedHosts:   map[string]bool{},
		allowedSchemes: map[string]bool{"http": true, "https": true},
		allowLocalhost: cfg.AllowLocalhost,
		allowPrivate:   cfg.AllowPrivate,
	}
	if len(cfg.AllowedSchemes) > 0 {
		p.allowedSchemes = map[string]bool{}
		for _, scheme := range cfg.AllowedSchemes {
			scheme = strings.ToLower(strings.TrimSpace(scheme))
			if scheme != "" {
				p.allowedSchemes[scheme] = true
			}
		}
	}
	for _, host := range cfg.AllowedHosts {
		host = normalizeHost(host)
		if host != "" {
			p.allowedHosts[host] = true
		}
	}
	for _, raw := range cfg.AllowedCIDRs {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		_, cidr, err := net.ParseCIDR(raw)
		if err != nil {
			return nil, fmt.Errorf("invalid network policy CIDR %q: %w", raw, err)
		}
		p.allowedCIDRs = append(p.allowedCIDRs, cidr)
	}
	return p, nil
}

func Default() *Policy {
	p, _ := New(Config{})
	return p
}

func (p *Policy) ValidateURL(ctx context.Context, raw string) error {
	if p == nil {
		p = Default()
	}
	if ctx == nil {
		ctx = context.Background()
	}
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return fmt.Errorf("network policy denied %q: invalid URL: %w", raw, err)
	}
	if u.Scheme == "" || u.Host == "" {
		return fmt.Errorf("network policy denied %q: URL must include scheme and host", raw)
	}
	scheme := strings.ToLower(u.Scheme)
	if !p.allowedSchemes[scheme] {
		return fmt.Errorf("network policy denied %q: scheme %q is not allowed", raw, scheme)
	}
	host := normalizeHost(u.Hostname())
	if host == "" {
		return fmt.Errorf("network policy denied %q: empty host", raw)
	}
	return p.validateHost(ctx, raw, host)
}

func (p *Policy) HTTPClient(timeout time.Duration) *http.Client {
	if p == nil {
		p = Default()
	}
	dialer := &net.Dialer{Timeout: timeout}
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
				host, _, err := net.SplitHostPort(address)
				if err != nil {
					host = address
				}
				if err := p.validateHost(ctx, address, normalizeHost(host)); err != nil {
					return nil, err
				}
				return dialer.DialContext(ctx, network, address)
			},
		},
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return fmt.Errorf("network policy denied redirect: too many redirects")
			}
			return p.ValidateURL(req.Context(), req.URL.String())
		},
	}
}

func (p *Policy) validateHost(ctx context.Context, raw, host string) error {
	if host == "" {
		return fmt.Errorf("network policy denied %q: empty host", raw)
	}
	if p.allowedHosts[host] {
		return nil
	}
	if ip := net.ParseIP(host); ip != nil {
		return p.validateIP(raw, host, ip)
	}
	if isLocalhostName(host) && !p.allowLocalhost {
		return fmt.Errorf("network policy denied %q: localhost host %q is blocked by default", raw, host)
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return fmt.Errorf("network policy denied %q: could not resolve host %q: %w", raw, host, err)
	}
	if len(addrs) == 0 {
		return fmt.Errorf("network policy denied %q: host %q resolved to no addresses", raw, host)
	}
	for _, addr := range addrs {
		if err := p.validateIP(raw, host, addr.IP); err != nil {
			return err
		}
	}
	return nil
}

func (p *Policy) validateIP(raw, host string, ip net.IP) error {
	if ip == nil {
		return fmt.Errorf("network policy denied %q: host %q resolved to an invalid IP", raw, host)
	}
	for _, cidr := range p.allowedCIDRs {
		if cidr.Contains(ip) {
			return nil
		}
	}
	if ip.IsLoopback() {
		if p.allowLocalhost {
			return nil
		}
		return fmt.Errorf("network policy denied %q: host %q resolves to loopback address %s", raw, host, ip.String())
	}
	if ip.IsPrivate() {
		if p.allowPrivate {
			return nil
		}
		return fmt.Errorf("network policy denied %q: host %q resolves to private address %s", raw, host, ip.String())
	}
	if ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return fmt.Errorf("network policy denied %q: host %q resolves to link-local address %s", raw, host, ip.String())
	}
	if ip.IsUnspecified() {
		return fmt.Errorf("network policy denied %q: host %q resolves to unspecified address %s", raw, host, ip.String())
	}
	if ip.IsMulticast() {
		return fmt.Errorf("network policy denied %q: host %q resolves to multicast address %s", raw, host, ip.String())
	}
	return nil
}

func normalizeHost(host string) string {
	host = strings.TrimSpace(strings.ToLower(host))
	if strings.HasPrefix(host, "[") && strings.HasSuffix(host, "]") {
		host = strings.TrimPrefix(strings.TrimSuffix(host, "]"), "[")
	}
	return strings.TrimSuffix(host, ".")
}

func isLocalhostName(host string) bool {
	host = normalizeHost(host)
	return host == "localhost" || strings.HasSuffix(host, ".localhost")
}

func (p *Policy) Summary() string {
	if p == nil {
		p = Default()
	}
	hosts := make([]string, 0, len(p.allowedHosts))
	for host := range p.allowedHosts {
		hosts = append(hosts, host)
	}
	sort.Strings(hosts)
	return fmt.Sprintf("schemes=%v allow_localhost=%t allow_private=%t allow_hosts=%v cidrs=%d", sortedKeys(p.allowedSchemes), p.allowLocalhost, p.allowPrivate, hosts, len(p.allowedCIDRs))
}

func sortedKeys(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
