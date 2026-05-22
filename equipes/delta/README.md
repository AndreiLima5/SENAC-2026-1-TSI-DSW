Markdown
# To-Do List Seguro - Equipe Delta

Este projeto é uma aplicação de Lista de Tarefas (To-Do List) completa, focada em produtividade e segurança da informação. A aplicação oferece um ambiente multiusuário isolado, garantindo a privacidade dos dados de cada conta.

## 🛠 Tecnologias Utilizadas e Arquitetura
* **Frontend:** HTML5, CSS3, Vanilla JavaScript.
  * Gerenciamento de estado local para navegação fluida por abas (Todas, Pendentes, Concluídas).
  * Proteção nativa contra ataques XSS via manipulação segura do DOM.
  * Design responsivo com interface moderna e alternância de visualização de senha.

* **Backend:** Go (1.22+).
  * Autenticação via **JWT (JSON Web Tokens)**.
  * Criptografia de senhas utilizando **Bcrypt**.
  * Roteamento nativo e Prepared Statements para proteção contra SQL Injection.

* **Banco de Dados:** MySQL (Tabelas relacionais de Usuários e Tarefas).
* **Infraestrutura Local:** Podman (com Multi-Stage Build para o Go e Nginx para o Frontend).

---

## 🚀 Como executar o projeto localmente com Podman

Certifique-se de ter o [Podman](https://podman.io/) (ou Docker) instalado na sua máquina. Abra o terminal na pasta raiz do projeto (`equipes/delta/`) e siga os passos abaixo:

### 1. Criar uma rede para os containers
Para que o backend consiga se comunicar com o banco de dados pelo nome, criamos uma rede interna:
```bash
podman network create delta-net
2. Iniciar o Banco de Dados (MySQL)
Este comando baixa a imagem do MySQL, define a senha e executa o script schema.sql automaticamente para criar as tabelas de users e tasks:

Bash
podman run -d --name todo-mysql --network delta-net \
  -e MYSQL_ROOT_PASSWORD=senha_segura_123 \
  -e MYSQL_DATABASE=todo_db \
  -p 3306:3306 \
  -v ./db/schema.sql:/docker-entrypoint-initdb.d/schema.sql:Z \
  docker.io/library/mysql:8.0
3. Iniciar o Backend (Go API)
Vamos rodar o container Go passando as credenciais do banco e a chave secreta de criptografia (JWT Secret):

Bash
podman run -d --name todo-backend --network delta-net \
  -p 8080:8080 \
  -v ./backend:/app:Z -w /app \
  -e DB_USER=root \
  -e DB_PASS=senha_segura_123 \
  -e DB_HOST=todo-mysql \
  -e DB_PORT=3306 \
  -e DB_NAME=todo_db \
  -e API_PORT=8080 \
  -e ALLOWED_ORIGIN="*" \
  -e JWT_SECRET=minha_chave_super_secreta_delta \
  docker.io/library/golang:1.22 \
  go run main.go

4. Iniciar o Frontend (Nginx)
Para servir os arquivos estáticos (HTML/CSS/JS), mapeamos a pasta frontend para o Nginx na porta 5500:

Bash
podman run -d --name todo-frontend --network delta-net \
  -p 5500:80 \
  -v ./frontend:/usr/share/nginx/html:Z \
  docker.io/library/nginx:alpine
  
5. Acessar a Aplicação
Com os três containers rodando, abra o seu navegador e acesse:
👉 http://localhost:5500

Você poderá criar uma conta, fazer login e gerenciar suas tarefas em um ambiente seguro!

🛑 Como parar e limpar o ambiente
Quando terminar de testar, você pode parar e remover os containers para liberar espaço na sua máquina:

Bash
# Parar os containers
podman stop todo-frontend todo-backend todo-mysql

# Remover os containers
podman rm todo-frontend todo-backend todo-mysql

# Remover a rede (opcional)
podman network rm delta-net