document.addEventListener('DOMContentLoaded', function() {
    pegarAno();
    const userInput = document.getElementById('user-input');
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});

// Função um pouco mais ajustada
function formatMarkdownToHTML(text) {
    let html = text
        .replace(/### (.*?)\n/g, '<h3>$1</h3>')
        .replace(/## (.*?)\n/g, '<h2>$1</h2>')
        .replace(/# (.*?)\n/g, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, function(match, lang, code) {

        const escapedCode = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre><code class="language-${lang || 'plaintext'}">${escapedCode}</code></pre>`;
    });

    html = html.replace(/^\s*\d+\.\s+(.+)/gm, '<li>$1</li>');
    html = html.replace(/^\s*[\-\*]\s+(.+)/gm, '<li>$1</li>');

    html = html.replace(/(<li>.*?<\/li>)+/gs, function(match) {
    
        if (match.includes('</ol>')) return match;
        if (match.includes('<ul>')) return match;
        const isOrdered = match.match(/<li>\d+\./);
        return isOrdered ? `<ol>${match}</ol>` : `<ul>${match}</ul>`;
    });

    html = html.replace(/\n(?!<pre>)/g, '<br>');

    return html;
}

function appendMessage(message, isUser, isCodeOutput = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = isUser ? 'user-message' : 'chatbot-message';

    if (isUser) {
        messageDiv.textContent = `Você: ${message}`;
    } else {
        // Adiciona wrapper para mensagem do chatbot
        const botLabel = document.createElement('div');
        botLabel.className = 'chatbot-label';
        botLabel.textContent = isCodeOutput ? 'Terminal:' : 'ZackBot:'; // Label diferente para output

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        if (isCodeOutput) {
            const pre = document.createElement('pre');
            pre.textContent = message; // textContent para manter a formatação de espaço
            messageContent.appendChild(pre);
        } else {
            messageContent.innerHTML = formatMarkdownToHTML(message);
        }
        
        messageDiv.appendChild(botLabel);
        messageDiv.appendChild(messageContent);
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendOutputToTerminal(output, isError = false) {
    const outputTerminal = document.getElementById('output-terminal-content');
    const timestamp = new Date().toLocaleTimeString();

    const messageDiv = document.createElement('div');
    messageDiv.className = isError ? 'terminal-error' : 'terminal-output';
    
    const header = document.createElement('div');
    header.className = 'terminal-entry-header';
    header.innerHTML = `<span>${isError ? 'Erro' : 'Saída'} (${timestamp}):</span>`;

    const content = document.createElement('pre');
    content.textContent = output;

    messageDiv.appendChild(header);
    messageDiv.appendChild(content);

    outputTerminal.appendChild(messageDiv);
    outputTerminal.scrollTop = outputTerminal.scrollHeight;
}

async function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();

    if (message) {
        // Mostra a mensagem do usuário
        appendMessage(message, true);
        userInput.value = '';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: message })
            });

            const data = await response.json();

            if (data.status === 'success') {
                // Mostra a resposta do chatbot
                appendMessage(data.response, false);
            } else {
                appendMessage("Desculpe, ocorreu um erro.", false);
            }
        } catch (error) {
            console.error('Erro:', error);
            appendMessage("Desculpe, ocorreu um erro ao processar sua mensagem.", false);
        }
    }
}

async function executeCode() {
    const editorInstance = window.monacoEditorInstance;
    if (!editorInstance) {
        console.error("Monaco Editor instance not found.");
        appendOutputToTerminal("Erro: Editor de código não encontrado para execução.", true);
        return;
    }
    const code = editorInstance.getValue();

    if (!code.trim()) {
        appendOutputToTerminal("Por favor, insira algum código para executar.", true);
        return;
    }

    document.getElementById('output-terminal-content').innerHTML = ''; 
    appendOutputToTerminal("Executando seu código...", false);

    try {
        const response = await fetch('/execute-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: code })
        });

        const data = await response.json();

        if (data.status === 'success') {
            appendOutputToTerminal(data.output, false);
            if (data.error) {
                appendOutputToTerminal(data.error, true);
            }
        } else {
            let errorMessage = "Erro desconhecido na execução código.";
            if (data.error) {
                errorMessage = data.error;
            } else if (data.output) {
                errorMessage = data.output;
            }
            appendOutputToTerminal(errorMessage, true);
        }
    } catch (error) {
        console.error('Erro ao executar código:', error);
        appendOutputToTerminal("Desculpe, ocorreu um erro ao se comunicar com o servidor para executar o código.", true);
    }
}

async function clearChat() {
    try {
        const response = await fetch('/clear-chat', {
            method: 'POST'
        });

        if (response.ok) {
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML = '';
        }
    } catch (error) {
        console.error('Erro ao limpar chat:', error);
    }
}

function pegarAno(){
    let anoElemento = document.getElementById("ano");
    
    let dataAtual = new Date();
    let anoAtual = dataAtual.getFullYear();
    anoElemento.value = anoAtual;

    return anoAtual;
}
