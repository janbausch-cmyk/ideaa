# FoundingEngineer Workspace: Git Push Pfad

Wie der FE-Agent (`95a1515d-…`) Commits nach `origin/main` (`github.com/janbausch-cmyk/ideaa`) bringt.

## Setup

- Remote: `https://github.com/janbausch-cmyk/ideaa.git` (HTTPS, kein SSH).
- Secret: `GITHUB_TOKEN` (Paperclip-Secret `5629d249-77d5-4cf0-b708-b75d61aed684`), via Agent-Config in jeden Heartbeat-Run injiziert.
- Token-Scope: PAT von `janbausch-cmyk`, `repo:push` auf `janbausch-cmyk/ideaa` (verifiziert via `GET /repos/janbausch-cmyk/ideaa` → `permissions.push=true`).
- Globale Git-Config (`~/.gitconfig`):

  ```
  [credential]
    helper = "!f() { test \"$1\" = get && printf \"username=x-access-token\\npassword=%s\\n\" \"$GITHUB_TOKEN\"; }; f"
  ```

  Das Helper-Skript schreibt den Token **nicht** auf die Platte; es liest ihn jedes Mal frisch aus `$GITHUB_TOKEN`. Wird der Token rotiert, reicht das Secret-Update — kein File-Touch nötig.

## Push verwenden

Im FE-Workspace ist `git push` jetzt einfach:

```bash
git push                # main → origin/main
git push -u origin <branch>
```

Kein `x-access-token@…`-Inline-URL nötig, keine `.git-credentials`-Datei, keine `gh auth login`-Session.

## Sanity-Checks bei Push-Problemen

1. Token im Env vorhanden? `echo "len=${#GITHUB_TOKEN}"` (erwartet ~93).
2. Token gültig? `curl -sS -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user` → HTTP 200, korrekter `login`.
3. Push-Permission? `curl -sS -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/repos/janbausch-cmyk/ideaa | jq .permissions` → `push: true`.
4. Credential-Helper aktiv? `git config --global --get credential.helper` muss den Helper oben zurückgeben.
5. Bei `403`/`401` trotz validem Token: PAT abgelaufen oder revoked → CEO/Jan in der zugehörigen IDEAA-Issue um Rotation bitten.

## Token-Rotation

Wenn der PAT abläuft:

1. Jan generiert neuen PAT mit `repo`-Scope für `janbausch-cmyk/ideaa`.
2. Paperclip-Secret `5629d249-77d5-4cf0-b708-b75d61aed684` wird mit dem neuen Wert überschrieben.
3. Nächster Heartbeat injiziert automatisch den neuen Token — kein Code-Change im FE-Workspace nötig.

## Historischer Kontext

- [IDEAA-86](/IDEAA/issues/IDEAA-86): Peak-Logo committed (`82398eb`), Push schlug fehl weil kein Credential-Helper konfiguriert war.
- [IDEAA-84](/IDEAA/issues/IDEAA-84): Jan musste manuellen Patch/Bundle-Transfer machen.
- [IDEAA-97](/IDEAA/issues/IDEAA-97): Push-Pfad repariert (dieses Dokument); Verifikations-Push `82398eb → origin/main` am 2026-06-01 erfolgreich.
