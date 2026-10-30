# 🎂 AniverGato Bot — Bot de Aniversários para Discord

Bot moderno de aniversários para Discord desenvolvido inteiramente em **TypeScript**, utilizando a **Discord.js v14+**, os novos **Containers e Components V2** e **Modais com Menu Dropdown (StringSelectMenu)**.

---

## 🚀 Principais Funcionalidades

1. **Cadastro Ultra Simplificado com Menu Dropdown**:
   - Um **Menu Dropdown (`StringSelectMenu`)** exibe todos os 12 meses do ano com emojis temáticos (`❄️ Janeiro`, `🎭 Fevereiro`, `🌱 Março`...).
   - Pode ser selecionado diretamente no container de apresentação do canal ou clicando no botão.
   - Assim que o usuário escolhe o mês no dropdown, o Discord abre instantaneamente o **Modal** solicitando apenas o **Dia de nascimento** daquele mês específico.
   - Validação inteligente de datas de acordo com o mês escolhido (até 29 em fevereiro, 30 nos meses curtos, 31 nos demais).

2. **Apresentação via JSON Totalmente Customizável (`presentation.json`)**:
   - O layout visual da mensagem de apresentação/painel é lido diretamente de um arquivo JSON.
   - O bot **extrai recursivamente os IDs dos botões (`custom_id`) do JSON** e registra dinamicamente o roteamento dos cliques!
   - Você pode trocar textos, cores de destaque (`accent_color`), emojis e IDs de botões no JSON sem precisar alterar o código-fonte.

3. **Discord Components V2 & Containers**:
   - Todas as respostas, confirmações, contagens regressivas e avisos utilizam `ContainerBuilder`, `TextDisplayBuilder`, `SeparatorBuilder` e a flag `MessageFlags.IsComponentsV2`.

4. **Persistência no MongoDB Atlas**:
   - Salva e gerencia os aniversários via Mongoose com índice composto único por servidor e usuário (`guildId` + `userId`).
   - Configuração com DNS resiliente para resolução SRV estável no Windows.

5. **Notificações Automáticas Agendadas & Agrupamento Inteligente**:
   - Agendamento diário com `node-cron` às 09:00 (horário de Brasília).
   - **Agrupamento Inteligente no mesmo dia**: Se mais de uma pessoa fizer aniversário no mesmo dia no servidor, o bot **não envia mensagens separadas/duplicadas**! Ele agrupa todos os aniversariantes em **uma única mensagem comemorativa** especial (com banner GIF e lista de aniversariantes).
   - Evita notificações duplicadas no mesmo ano com controle `lastNotifiedYear`.

---

## 📁 Estrutura do Projeto

```
anivergato-bot/
├── .env                          # Variáveis de ambiente (TOKEN, MONGODB_URI, etc.)
├── package.json                  # Scripts e dependências
├── tsconfig.json                 # Configuração TypeScript NodeNext
├── presentation.json             # Layout JSON do container de apresentação (editável)
└── src/
    ├── index.ts                  # Ponto de entrada principal
    ├── config/
    │   └── database.ts           # Conexão MongoDB com fallback DNS
    ├── models/
    │   ├── Birthday.ts           # Model de Aniversários
    │   └── GuildConfig.ts        # Model de Configurações do Servidor
    ├── components/
    │   └── birthdayModal.ts      # Modal com TextInput (Dia) e StringSelectMenu (Mês)
    ├── services/
    │   ├── notificationService.ts# Envio das notificações comemorativas
    │   └── birthdayScheduler.ts  # Rotina diária do node-cron
    ├── utils/
    │   ├── containerFactory.ts   # Fábrica de Containers Components V2
    │   ├── dateUtils.ts          # Validação e formatação de datas
    │   └── presentationLoader.ts # Leitura de presentation.json e extração de botões
    ├── commands/
    │   ├── painel.ts             # /painel-aniversario
    │   ├── aniversario.ts        # /aniversario (ver, remover, listar)
    │   ├── config.ts             # /config-canal
    │   └── testar.ts             # /testar-notificacao
    ├── handlers/
    │   ├── commandHandler.ts     # Registro de comandos na API REST
    │   └── interactionHandler.ts # Roteamento de botões, modais e slash commands
    └── types/
        └── index.ts              # Interfaces e tipagens TypeScript
```

---

## 🛠️ Como Funciona o `presentation.json`

O arquivo `presentation.json` na raiz define o layout do container de boas-vindas:

```json
{
  "flags": 32768,
  "components": [
    {
      "type": 17,
      "accent_color": 16744576,
      "components": [
        {
          "type": 10,
          "content": "# 🎂 Central de Aniversários do Servidor\n\nCadastre seu aniversário..."
        },
        {
          "type": 1,
          "components": [
            {
              "type": 2,
              "custom_id": "btn_birthday_register",
              "label": "Cadastrar Aniversário",
              "style": 1
            }
          ]
        }
      ]
    }
  ]
}
```

O `presentationLoader.ts` varre os componentes, encontra o botão com `custom_id: "btn_birthday_register"`, e o vincula à ação de abrir o modal de cadastro.

---

## ⌨️ Comandos Slash Disponíveis

| Comando | Descrição | Permissão |
|---|---|---|
| `/painel-aniversario [canal]` | Envia o painel de apresentação configurado no `presentation.json` | Administrador |
| `/config-canal [canal] [cargo]` | Define o canal de anúncios e cargo mencionado nos aniversários | Administrador |
| `/testar-notificacao [usuario]` | Dispara imediatamente o card comemorativo festivo com GIF no canal | Administrador |
| `/aniversario listar` | Lista todos os aniversariantes do servidor por data | Administrador |
| `/aniversario ver [usuario]` | Exibe o aniversário e contagem regressiva | Público (Livre) |
| `/aniversario remover` | Remove o seu aniversário registrado no servidor | Público (Livre) |

---

## ⚙️ Comandos de Execução

- **Modo Desenvolvimento** (Hot reload com `tsx`):
  ```bash
  npm run dev
  ```

- **Execução Normal**:
  ```bash
  npm start
  ```

- **Compilar para Produção**:
  ```bash
  npm run build
  npm run start:dist
  ```

