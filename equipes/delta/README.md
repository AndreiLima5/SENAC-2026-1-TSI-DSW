# To-Do List - Equipe Delta

Este projeto é uma aplicação de Lista de Tarefas (To-Do List) completa, desenvolvida com o objetivo de consolidar conhecimentos em desenvolvimento web e práticas de segurança.

## 🛠 Tecnologias Utilizadas
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Foco em manipulação segura do DOM para evitar XSS).
* **Backend:** Go (API RESTful utilizando roteamento nativo do Go 1.22+ e Prepared Statements).
* **Banco de Dados:** MySQL.
* **Infraestrutura Local:** Podman.

## 🚀 Como executar o projeto localmente com Podman

Certifique-se de ter o [Podman](https://podman.io/) instalado na sua máquina. Abra o terminal na pasta raiz do projeto (`equipes/delta/`) e siga os passos abaixo:

### 1. Criar uma rede para os containers
Para que o backend consiga se comunicar com o banco de dados pelo nome, criamos uma rede interna:
`podman network create delta-net`

### 2. Iniciar o Banco de Dados (MySQL)
Este comando baixa a imagem do MySQL, define a senha, expõe a porta e já roda o script `schema.sql` automaticamente para criar a tabela:
`podman run -d --name todo-mysql --network delta-net -e MYSQL_ROOT_PASSWORD=senha_segura_123 -e MYSQL_DATABASE=todo_db -p 3306:3306 -v ./db/schema.sql:/docker-entrypoint-initdb.d/schema.sql:Z docker.io/library/mysql:8.0`

### 3. Iniciar o Backend (Go API)
Vamos rodar um container Go que lê os arquivos da pasta `backend` e executa a API na porta 8080:
`podman run -d --name todo-backend --network delta-net -p 8080:8080 -v ./backend:/app:Z -w /app -e DB_USER=root -e DB_PASS=senha_segura_123 -e DB_HOST=todo-mysql -e DB_PORT=3306 -e DB_NAME=todo_db -e API_PORT=8080 -e ALLOWED_ORIGIN="http://localhost:5500" docker.io/library/golang:1.22 go run main.go`

### 4. Iniciar o Frontend (Nginx)
Para servir os arquivos estáticos (HTML/CSS/JS), utilizaremos um servidor Nginx leve, mapeando a pasta `frontend` para a porta 5500:
`podman run -d --name todo-frontend --network delta-net -p 5500:80 -v ./frontend:/usr/share/nginx/html:Z docker.io/library/nginx:alpine`

### 5. Acessar a Aplicação
Com os três containers rodando, abra o seu navegador e acesse:
👉 **[http://localhost:5500](http://localhost:5500)**

---

## 🛑 Como parar e limpar o ambiente

Quando terminar de testar, você pode parar e remover os containers para liberar espaço:

`podman stop todo-frontend todo-backend todo-mysql`
`podman rm todo-frontend todo-backend todo-mysql`
`podman network rm delta-net`