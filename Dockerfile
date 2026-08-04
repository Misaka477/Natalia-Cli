FROM docker.io/oven/bun:1.3.14 AS bun-build

WORKDIR /src
COPY . .
RUN bun install --frozen-lockfile

FROM ubuntu:24.04 AS wezterm-build

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      build-essential ca-certificates curl pkg-config libdbus-1-dev \
      libfontconfig1-dev libfreetype6-dev libssl-dev libx11-dev \
      libxcb-shape0-dev libxcb-xfixes0-dev libxkbcommon-dev libzstd-dev \
    && rm -rf /var/lib/apt/lists/*
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
ENV PATH=/root/.cargo/bin:${PATH}
WORKDIR /src
COPY packages/native-terminal/wezterm ./packages/native-terminal/wezterm
RUN cargo build --manifest-path packages/native-terminal/wezterm/Cargo.toml --release \
    --bin wezterm --bin wezterm-gui --bin wezterm-mux-server

FROM ubuntu:24.04

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
