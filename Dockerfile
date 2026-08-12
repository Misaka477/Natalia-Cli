FROM docker.io/oven/bun:1.3.14 AS bun-build

WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile

FROM ubuntu:24.04 AS wezterm-build

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /src
COPY packages/native-terminal/wezterm ./packages/native-terminal/wezterm
# The fork's own get-deps script is the canonical build-dependency list
# (Wayland/X11/EGL/Mesa/fonts...); the hand-maintained subset used to miss
# libraries such as libwayland-dev. get-deps requires rust to already be on
# PATH, hence the rustup step first.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal \
    && export PATH=/root/.cargo/bin:$PATH \
    && cd packages/native-terminal/wezterm && bash get-deps \
    && rm -rf /var/lib/apt/lists/*
ENV PATH=/root/.cargo/bin:${PATH}
# crates.io / git dependencies time out on a direct connection here; the build
# host's local proxy (reachable under --network=host) serves them. apt stays on
# the direct network because the proxy 502s archive.ubuntu.com.
ENV http_proxy=http://127.0.0.1:7890 \
    https_proxy=http://127.0.0.1:7890 \
    HTTP_PROXY=http://127.0.0.1:7890 \
    HTTPS_PROXY=http://127.0.0.1:7890
RUN cargo build --manifest-path packages/native-terminal/wezterm/Cargo.toml --release \
    --bin wezterm --bin wezterm-gui --bin wezterm-mux-server

FROM ubuntu:24.04 AS cli

RUN useradd --create-home --uid 10001 --shell /bin/bash natalia

COPY --from=bun-build /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-build /src /opt/natalia
COPY --from=wezterm-build /src/packages/native-terminal/wezterm/target/release/wezterm /opt/natalia/packages/native-terminal/wezterm/target/release/wezterm
COPY --from=wezterm-build /src/packages/native-terminal/wezterm/target/release/wezterm-gui /opt/natalia/packages/native-terminal/wezterm/target/release/wezterm-gui
COPY --from=wezterm-build /src/packages/native-terminal/wezterm/target/release/wezterm-mux-server /opt/natalia/packages/native-terminal/wezterm/target/release/wezterm-mux-server

WORKDIR /workspace
ENV HOME=/tmp/natalia-home \
    XDG_RUNTIME_DIR=/tmp/natalia-runtime \
    PATH=/opt/natalia/node_modules/.bin:${PATH}
USER natalia
ENTRYPOINT ["bun", "/opt/natalia/apps/cli/src/main.ts"]

# SSH-interactive deployment image: sshd + natalia/natalia-cli launchers so a
# headless Ubuntu 24.04 server can be operated over SSH. Build with
# `docker build --target server` (default), or `--target cli` for the plain
# CLI image.
FROM cli AS server

USER root
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /run/sshd /home/natalia/.ssh \
    && chown -R natalia:natalia /home/natalia/.ssh \
    && chown natalia:natalia /workspace \
    && sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config \
    && printf "UsePAM no\nPasswordAuthentication yes\nKbdInteractiveAuthentication no\n" >> /etc/ssh/sshd_config \
    && mkdir -p /opt/natalia/docker
COPY docker/server-entrypoint.sh /opt/natalia/docker/server-entrypoint.sh
COPY docker/natalia /usr/local/bin/natalia
COPY docker/natalia-cli /usr/local/bin/natalia-cli
RUN chmod +x /opt/natalia/docker/server-entrypoint.sh /usr/local/bin/natalia /usr/local/bin/natalia-cli

ENV HOME=/home/natalia
# sshd must start as root; SSH sessions themselves run as the natalia user.
USER root
WORKDIR /workspace
EXPOSE 22
ENTRYPOINT ["/opt/natalia/docker/server-entrypoint.sh"]
