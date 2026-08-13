FROM docker.io/oven/bun:1.3.14 AS bun-build

WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile

FROM ubuntu:24.04 AS wezterm-build

# The WezTerm fork is built inside the `natalia-ubuntu-build` podman container
# (scripts/build-wezterm-ubuntu.ts) so the executables only require the Ubuntu
# glibc (2.39), then staged into packages/native-terminal/wezterm/target/release.
# This stage copies those host-staged binaries (staged under deploy/wezterm-bin
# so the 2.8G cargo target stays out of the build context) instead of
# recompiling inside `docker build`, because building on the Docker host would
# (a) require the full Rust toolchain and crates.io/github access at
# image-build time, and (b) risk linking against the host's glibc.
# Run the build script before `docker build`:
#   npm run native-terminal:build-wezterm:ubuntu
COPY deploy/wezterm-bin/wezterm /src/packages/native-terminal/wezterm/target/release/wezterm
COPY deploy/wezterm-bin/wezterm-gui /src/packages/native-terminal/wezterm/target/release/wezterm-gui
COPY deploy/wezterm-bin/wezterm-mux-server /src/packages/native-terminal/wezterm/target/release/wezterm-mux-server

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
