#
# Dockerfile for Pentest Agent
# Uses Kali Linux rolling — industry-standard pentesting OS with tools pre-installed

# Builder stage: install toolchain and build the Node.js application
FROM kalilinux/kali-rolling AS builder

ENV DEBIAN_FRONTEND=noninteractive

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    ca-certificates \
    python3 \
    python3-pip \
    python3-dev \
    ruby \
    ruby-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Python-based security tools
RUN pip3 install --no-cache-dir --break-system-packages schemathesis==4.13.0

# Install OPSEC HTTP module dependencies
COPY apps/worker/src/docker/requirements-opsec.txt /tmp/requirements-opsec.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements-opsec.txt

# Install pnpm
RUN npm install -g pnpm@10.33.0

WORKDIR /app

# Copy workspace manifests for install layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/worker/package.json ./apps/worker/
COPY apps/cli/package.json ./apps/cli/

RUN pnpm install --frozen-lockfile

COPY . .

# Copy vanguard-fetch onto PATH (curl_cffi already installed above)
RUN install -m 755 apps/worker/src/docker/vanguard-fetch.py /usr/local/bin/vanguard-fetch

# Build worker. CLI not needed in Docker
RUN pnpm --filter @vanguard/worker run build

# Production-only deps
RUN rm -rf node_modules apps/*/node_modules && pnpm install --frozen-lockfile --prod


# Runtime stage: Kali Linux with security tools and worker application
FROM kalilinux/kali-rolling AS runtime

ENV DEBIAN_FRONTEND=noninteractive

# Install runtime dependencies and Kali security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core utilities
    git \
    bash \
    curl \
    ca-certificates \
    procps \
    # Security tools (Kali-packaged)
    nmap \
    subfinder \
    whatweb \
    # Language runtimes
    python3 \
    python3-pip \
    python3-dev \
    ruby \
    # Chromium and rendering dependencies
    chromium \
    fonts-liberation \
    fontconfig \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2t64 \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22 via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install GitHub CLI
RUN mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
       | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Install Python-based security tools in runtime
RUN pip3 install --no-cache-dir --break-system-packages schemathesis==4.13.0

# Copy OPSEC HTTP module (curl_cffi installed fresh below)
COPY --from=builder /tmp/requirements-opsec.txt /tmp/requirements-opsec.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements-opsec.txt
COPY --from=builder /usr/local/bin/vanguard-fetch /usr/local/bin/vanguard-fetch

# Create non-root user
RUN groupadd -g 1001 pentest && \
    useradd -u 1001 -g pentest -s /bin/bash -M pentest

# System-level git config (survives UID remapping in entrypoint)
RUN git config --system user.email "agent@localhost" && \
    git config --system user.name "Pentest Agent" && \
    git config --system --add safe.directory '*'

WORKDIR /app

# Copy only what the worker needs (skip CLI source, infra, tsdown artifacts)
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/.npmrc /app/
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/worker /app/apps/worker
COPY --from=builder /app/apps/cli/package.json /app/apps/cli/package.json

RUN npm install -g @anthropic-ai/claude-code@2.1.84 @playwright/cli@0.1.1
RUN mkdir -p /tmp/.claude/skills && \
    playwright-cli install --skills && \
    cp -r .claude/skills/playwright-cli /tmp/.claude/skills/ && \
    rm -rf .claude

# Symlink CLI tools onto PATH
RUN ln -s /app/apps/worker/dist/scripts/save-deliverable.js /usr/local/bin/save-deliverable && \
    chmod +x /app/apps/worker/dist/scripts/save-deliverable.js && \
    ln -s /app/apps/worker/dist/scripts/generate-totp.js /usr/local/bin/generate-totp && \
    chmod +x /app/apps/worker/dist/scripts/generate-totp.js

# Create directories for session data and ensure proper permissions
RUN mkdir -p /app/sessions /app/repos /app/workspaces && \
    mkdir -p /tmp/.cache /tmp/.config /tmp/.npm && \
    chmod 777 /app && \
    chmod 777 /tmp/.cache && \
    chmod 777 /tmp/.config && \
    chmod 777 /tmp/.npm && \
    chown -R pentest:pentest /app /tmp/.claude

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PATH="/usr/local/bin:$PATH"
ENV SHANNON_DOCKER=true
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_MCP_EXECUTABLE_PATH=/usr/bin/chromium
ENV npm_config_cache=/tmp/.npm
ENV HOME=/tmp
ENV XDG_CACHE_HOME=/tmp/.cache
ENV XDG_CONFIG_HOME=/tmp/.config
ENV DEBIAN_FRONTEND=noninteractive

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "apps/worker/dist/temporal/worker.js"]
