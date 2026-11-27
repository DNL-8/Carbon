# Execute com: pwsh -File scripts/sync-github.ps1
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path

function Invoke-Git {
    & git -C $repo @args
    if ($LASTEXITCODE -ne 0) {
        throw "O Git retornou erro ao executar: git $($args -join ' ')"
    }
}

$branch = Invoke-Git branch --show-current
if (-not $branch) {
    throw 'Selecione uma branch antes de sincronizar.'
}

Write-Host "Branch atual: $branch"
Write-Host '1. Baixar do GitHub — atualiza esta branch com os commits da nuvem, preservando o histórico.'
Write-Host '2. Enviar ao GitHub — mostra as alterações, cria um commit com sua mensagem e envia esta branch.'
$option = Read-Host 'Digite 1 ou 2'

if ($option -notin '1', '2') {
    throw 'Opção inválida. Escolha 1 ou 2.'
}

Invoke-Git fetch origin
$remoteBranch = "origin/$branch"

if ($option -eq '1') {
    if (Invoke-Git status --porcelain) {
        throw 'Há alterações locais. Registre ou guarde as alterações antes de baixar os commits.'
    }

    Invoke-Git merge --ff-only $remoteBranch
    Invoke-Git status --short --branch
    return
}

& git -C $repo merge-base --is-ancestor $remoteBranch HEAD
if ($LASTEXITCODE -ne 0) {
    throw 'A branch remota avançou, divergiu ou ainda não existe. Confira a branch e integre as mudanças remotas antes de enviar.'
}

$changes = Invoke-Git status --short
if ($changes) {
    $changes | ForEach-Object { Write-Host $_ }
    Write-Host 'Serão incluídas alterações, exclusões e arquivos novos não ignorados. Confira a lista antes de continuar.'
    if ((Read-Host 'Digite ENVIAR para confirmar') -cne 'ENVIAR') {
        Write-Host 'Envio cancelado.'
        return
    }

    $message = Read-Host 'Mensagem do commit'
    if ([string]::IsNullOrWhiteSpace($message)) {
        throw 'Informe uma mensagem de commit.'
    }

    Invoke-Git add --all
    Invoke-Git diff --cached --check
    Invoke-Git commit -m $message
}

Invoke-Git push origin "HEAD:refs/heads/$branch"
Invoke-Git status --short --branch
