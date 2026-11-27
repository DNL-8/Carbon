
$ErrorActionPreference = "Stop"

if ((git rev-parse --is-inside-work-tree 2>$null) -ne "true") {
    Write-Host "Esta pasta nao e um repositorio Git." -ForegroundColor Red
    exit 1
}

do {
    Clear-Host

    $branch = git branch --show-current

    Write-Host "====================================" -ForegroundColor Cyan
    Write-Host "       GITHUB - SINCRONIZACAO"
    Write-Host "====================================" -ForegroundColor Cyan
    Write-Host "Branch atual: $branch"
    Write-Host ""
    Write-Host "[1] Baixar mudancas do GitHub"
    Write-Host "[2] Revisar, registrar e enviar mudancas"
    Write-Host "[0] Sair"
    Write-Host ""

    $opcao = Read-Host "Escolha uma opcao"

    switch ($opcao) {
        "1" {
            if (git status --porcelain) {
                Write-Host "Existem mudancas locais pendentes." -ForegroundColor Yellow
                Write-Host "Revise suas mudancas antes de baixar."
            } else {
                git pull --ff-only

                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Projeto atualizado!" -ForegroundColor Green
                } else {
                    Write-Host "Nao foi possivel atualizar." -ForegroundColor Red
                }
            }
        }

        "2" {
            git status
            git --no-pager diff
            git --no-pager diff --cached

            if (git status --porcelain) {
                $confirmar = Read-Host "Registrar todas as mudancas? (s/n)"

                if ($confirmar -ne "s") {
                    break
                }

                $mensagem = Read-Host "Mensagem do commit"

                if ([string]::IsNullOrWhiteSpace($mensagem)) {
                    Write-Host "Informe uma mensagem valida." -ForegroundColor Yellow
                    break
                }

                git add -A
                if ($LASTEXITCODE -ne 0) { break }

                git commit -m "$mensagem"
                if ($LASTEXITCODE -ne 0) { break }
            }

            if (-not $branch) {
                Write-Host "Nenhuma branch ativa." -ForegroundColor Red
                break
            }

            $enviar = Read-Host "Enviar commits ao GitHub? (s/n)"

            if ($enviar -eq "s") {
                git push -u origin $branch

                if ($LASTEXITCODE -eq 0) {
                    Write-Host "GitHub atualizado!" -ForegroundColor Green
                } else {
                    Write-Host "Falha no envio. Seus commits locais foram preservados." -ForegroundColor Red
                }
            }
        }

        "0" {
            Write-Host "Encerrando..."
        }

        default {
            Write-Host "Opcao invalida." -ForegroundColor Yellow
        }
    }

    if ($opcao -ne "0") {
        Read-Host "Pressione Enter para continuar"
    }

} while ($opcao -ne "0")
