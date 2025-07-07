from flask import Flask, render_template, request, jsonify, session
import os
from dotenv import load_dotenv
import google.generativeai as genai
from app.utils.embedding_manager import EmbeddingManager
import subprocess
import sys
import io

# Carrega as variáveis de ambiente do arquivo .env
load_dotenv()

app = Flask(__name__)
app.secret_key = os.urandom(24)  # Necessário para usar sessions

# Configurar a chave da API do Google
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY não encontrada nas variáveis de ambiente")

# Configuração do modelo Gemini
genai.configure(api_key=GOOGLE_API_KEY)

# Configurações de segurança corretas
safety_settings = [
    {
        "category": "HARM_CATEGORY_HARASSMENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_HATE_SPEECH",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    },
    {
        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
        "threshold": "BLOCK_MEDIUM_AND_ABOVE"
    }
]

# Configuração do modelo
generation_config = {
    "temperature": 0.9,
    "top_p": 1,
    "top_k": 1,
    "max_output_tokens": 2048,
}

# Inicialização do modelo
model = genai.GenerativeModel(
    model_name="models/gemini-1.5-flash",
    generation_config=generation_config,
    safety_settings=safety_settings
)

# Instância global do EmbeddingManager
try:
    embedding_manager = EmbeddingManager(GOOGLE_API_KEY)
except Exception as e:
    print(f"Aviso: Não foi possível inicializar EmbeddingManager. Certifique-se de que 'app/utils/embedding_manager.py' existe e está correto: {e}")
    embedding_manager = None

# Dicionário para armazenar as sessões de chat
chat_sessions = {}

@app.route('/')
def index():
    # Gera um ID de sessão único se não existir
    if 'chat_id' not in session:
        session['chat_id'] = os.urandom(16).hex()
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        user_message = request.json['message']
        chat_id = session.get('chat_id')
        
        # Inicializa uma nova sessão de chat se necessário
        if chat_id not in chat_sessions:
            chat = model.start_chat(history=[])
            chat_sessions[chat_id] = chat
            
            # Busca o contexto relevante
            context = ""
            if embedding_manager:
                context = embedding_manager.search_query("Aprendizagem com foco em Maratonas de Programação para iniciantes e estudantes focado exclusivamente em responder questões baseadas em maratonas e desafios de programação, ajudando a compreender da melhor forma o problema relatado pelo usuário.")
            
            # Prompt inicial com instruções e contexto
            initial_prompt = f"""Você é um especialista brincalhão no assunto descrito no seguinte contexto: 

{context}

Instruções importantes:
1. Baseie suas respostas principalmente no contexto fornecido
2. Você pode adicionar informações complementares sobre o tema, desde que sejam precisas e relevantes
3. Se a pergunta fugir do tema do contexto, gentilmente redirecione para o assunto principal
4. Use markdown quando apropriado para melhorar a legibilidade:
   - **negrito** para termos importantes
   - `código` para termos técnicos
   - Listas numeradas para sequências
   - Listas com bullets para itens relacionados
   - ### para subtítulos quando necessário
5. Mantenha suas respostas organizadas e fáceis de ler
6. Responda sempre em português

Por favor, confirme que entendeu estas instruções respondendo com uma breve saudação."""
            
            # Envia o prompt inicial
            chat.send_message(initial_prompt)
        
        chat = chat_sessions[chat_id]
        response = chat.send_message(user_message)
        
        return jsonify({
            'response': response.text,
            'status': 'success'
        })
        
    except Exception as e:
        print(f"Erro ao processar mensagem: {str(e)}")
        return jsonify({
            'response': "Desculpe, ocorreu um erro ao processar sua mensagem.",
            'status': 'error'
        }), 500

@app.route('/execute-code', methods=['POST'])
def execute_code():
    try:
        code = request.json['code']

        old_stdout = sys.stdout
        old_stderr = sys.stderr
        redirected_output = io.StringIO()
        redirected_error = io.StringIO()
        sys.stdout = redirected_output
        sys.stderr = redirected_error

        execution_successful = True
        try:
            exec(code)
        except Exception as e:
            execution_successful = False
            error_output = redirected_error.getvalue() + str(e)
            
        finally:
            sys.stdout = old_stdout 
            sys.stderr = old_stderr

        output = redirected_output.getvalue()
        error_output = redirected_error.getvalue()

        if execution_successful:
            return jsonify({
                'output': output,
                'error': error_output,
                'status': 'success'
            })
        else:
            return jsonify({
                'output': output,
                'error': error_output,
                'status': 'error'
            })

    except Exception as e:
        print(f"Erro no endpoint /execute-code: {str(e)}")
        return jsonify({
            'output': '',
            'error': f"Erro interno do servidor: {str(e)}",
            'status': 'error'
        }), 500

# Rota para limpar o histórico do chat
@app.route('/clear-chat', methods=['POST'])
def clear_chat():
    try:
        if 'chat_id' in session:
            chat_id = session['chat_id']
            if chat_id in chat_sessions:
                del chat_sessions[chat_id]
        session.pop('chat_id', None)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
