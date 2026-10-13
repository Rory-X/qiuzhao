FROM golang:1.24.4-bookworm

ARG GONB_VERSION=v0.11.4
ARG JUPYTERLAB_VERSION=4.6.1
ARG GOIMPORTS_VERSION=v0.34.0
ARG GOPLS_VERSION=v0.19.1
ARG USER_ID=1000
ARG GROUP_ID=1000

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages "jupyterlab==${JUPYTERLAB_VERSION}"

RUN go install "github.com/janpfeifer/gonb@${GONB_VERSION}" \
    && go install "golang.org/x/tools/cmd/goimports@${GOIMPORTS_VERSION}" \
    && go install "golang.org/x/tools/gopls@${GOPLS_VERSION}"

RUN groupadd --gid "${GROUP_ID}" learner \
    && useradd --create-home --uid "${USER_ID}" --gid "${GROUP_ID}" --shell /bin/bash learner \
    && mkdir -p /workspace/notebooks \
    && chown -R learner:learner /workspace

COPY --chown=learner:learner go.work.container /workspace/go.work

USER learner

RUN gonb --install

WORKDIR /workspace/notebooks

EXPOSE 8888

CMD ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--ServerApp.port_retries=0", "--no-browser", "--ServerApp.root_dir=/workspace", "--IdentityProvider.token=", "--ServerApp.password="]
