# Runner efêmero do lattes-editor: um container por job, sem sudo.
# Base: imagem oficial do runner, fixada por digest (2.338.0).
FROM ghcr.io/actions/actions-runner@sha256:4ffadc0002b2581327e06101fc8c06cd189232baf79fe561fac9caeb76f5e807

USER root
# gh vem do repositório oficial do GitHub CLI; o do Ubuntu é antigo. xmllint
# para os testes de XSD, xz e zstd para o cache das actions.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg libxml2-utils xz-utils zstd; \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      -o /usr/share/keyrings/githubcli-archive-keyring.gpg; \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends gh; \
    rm -rf /var/lib/apt/lists/*; \
    gpasswd -d runner sudo; \
    rm -f /etc/sudoers.d/*

USER runner
