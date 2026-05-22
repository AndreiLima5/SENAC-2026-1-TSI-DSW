package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

// Estruturas
type User struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type Task struct {
	ID        int    `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

var db *sql.DB

func main() {
	godotenv.Load()

	// Conexão com Banco
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s", os.Getenv("DB_USER"), os.Getenv("DB_PASS"), os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_NAME"))
	var err error
	db, err = sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	mux := http.NewServeMux()

	// Rotas Públicas (Não precisam de token)
	mux.HandleFunc("POST /api/v1/register", registerHandler)
	mux.HandleFunc("POST /api/v1/login", loginHandler)

	// Rotas Protegidas (Precisam de token JWT)
	mux.Handle("GET /api/v1/tasks", authMiddleware(http.HandlerFunc(getTasks)))
	mux.Handle("POST /api/v1/tasks", authMiddleware(http.HandlerFunc(createTask)))
	mux.Handle("PUT /api/v1/tasks/{id}", authMiddleware(http.HandlerFunc(updateTask)))
	mux.Handle("DELETE /api/v1/tasks/{id}", authMiddleware(http.HandlerFunc(deleteTask)))

	// Middleware Global (CORS)
	handler := securityMiddleware(mux)

	fmt.Println("API rodando na porta 8080 com Autenticação JWT...")
	log.Fatal(http.ListenAndServe(":8080", handler))
}

// ==========================================
// MIDDLEWARES
// ==========================================
func securityMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Content-Type", "application/json")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Verifica se o usuário mandou o Token JWT válido
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"error": "Acesso negado. Token não fornecido."}`, http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		jwtSecret := []byte(os.Getenv("JWT_SECRET"))

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			http.Error(w, `{"error": "Token inválido ou expirado."}`, http.StatusUnauthorized)
			return
		}

		// Extrai o ID do usuário do token e coloca no contexto da requisição
		claims, _ := token.Claims.(jwt.MapClaims)
		userID := int(claims["user_id"].(float64))
		ctx := context.WithValue(r.Context(), "userID", userID)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ==========================================
// AUTENTICAÇÃO (Login / Registro)
// ==========================================
func registerHandler(w http.ResponseWriter, r *http.Request) {
	var user User
	json.NewDecoder(r.Body).Decode(&user)

	// Criptografa a senha antes de salvar
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)

	stmt, _ := db.Prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
	defer stmt.Close()

	_, err := stmt.Exec(user.Username, hashedPassword)
	if err != nil {
		http.Error(w, `{"error": "Usuário já existe ou erro no banco"}`, http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Write([]byte(`{"message": "Usuário criado com sucesso!"}`))
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	var user User
	json.NewDecoder(r.Body).Decode(&user)

	var id int
	var hash string
	err := db.QueryRow("SELECT id, password_hash FROM users WHERE username = ?", user.Username).Scan(&id, &hash)

	// Verifica se achou o usuário e se a senha bate com a criptografia
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(user.Password)) != nil {
		http.Error(w, `{"error": "Credenciais inválidas"}`, http.StatusUnauthorized)
		return
	}

	// Gera o Token JWT com validade de 24 horas
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": id,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	})

	tokenString, _ := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

	json.NewEncoder(w).Encode(map[string]string{"token": tokenString})
}

// ==========================================
// CRUD DE TAREFAS (Agora filtradas por usuário)
// ==========================================
func getTasks(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)

	rows, _ := db.Query("SELECT id, title, completed FROM tasks WHERE user_id = ?", userID)
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		rows.Scan(&t.ID, &t.Title, &t.Completed)
		tasks = append(tasks, t)
	}

	if tasks == nil {
		tasks = []Task{}
	}
	json.NewEncoder(w).Encode(tasks)
}

func createTask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)
	var t Task
	json.NewDecoder(r.Body).Decode(&t)

	stmt, _ := db.Prepare("INSERT INTO tasks (user_id, title, completed) VALUES (?, ?, ?)")
	defer stmt.Close()

	res, _ := stmt.Exec(userID, t.Title, false)
	id, _ := res.LastInsertId()
	t.ID = int(id)

	json.NewEncoder(w).Encode(t)
}

func updateTask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)
	taskID := r.PathValue("id")
	var t Task
	json.NewDecoder(r.Body).Decode(&t)

	// Atualiza apenas se a tarefa pertencer a este usuário
	stmt, _ := db.Prepare("UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?")
	defer stmt.Close()
	stmt.Exec(t.Completed, taskID, userID)
	w.WriteHeader(http.StatusOK)
}

func deleteTask(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value("userID").(int)
	taskID := r.PathValue("id")

	stmt, _ := db.Prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?")
	defer stmt.Close()
	stmt.Exec(taskID, userID)
	w.WriteHeader(http.StatusOK)
}
