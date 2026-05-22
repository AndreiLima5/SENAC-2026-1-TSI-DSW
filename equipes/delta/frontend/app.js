const API_BASE = 'http://localhost:8080/api/v1';

// Estado Local da Aplicação
let tasksData = [];
let currentFilter = 'all'; // Pode ser 'all', 'pending', 'completed'

document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupAuthEvents();
    setupAppEvents();
});

// ==========================================
// AUTENTICAÇÃO E NAVEGAÇÃO DE TELAS
// ==========================================
function setupAuthEvents() {
    // Alternar entre Login e Registro
    document.getElementById('goToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('registerView').classList.remove('hidden');
        clearMessages();
    });

    document.getElementById('goToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('registerView').classList.add('hidden');
        document.getElementById('loginView').classList.remove('hidden');
        clearMessages();
    });

    // Submissão dos Formulários
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', function() {
            // Pega o ID do input (loginPass ou regPass)
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = this.querySelector('svg');

            // Troca o tipo do input
            if (input.type === 'password') {
                input.type = 'text';
                // Muda o ícone para "Olho Fechado" (com um risco)
                icon.innerHTML = `
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
            } else {
                input.type = 'password';
                // Muda o ícone de volta para "Olho Aberto"
                icon.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        });
    });
}

function clearMessages() {
    document.getElementById('loginMessage').textContent = '';
    document.getElementById('regMessage').textContent = '';
}

async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value.trim();
    const msg = document.getElementById('loginMessage');

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('delta_token', data.token);
            e.target.reset();
            checkAuthStatus();
        } else {
            msg.textContent = data.error || 'Credenciais inválidas.';
        }
    } catch (err) { msg.textContent = 'Erro de conexão.'; }
}

async function handleRegister(e) {
    e.preventDefault();
    const u = document.getElementById('regUser').value.trim();
    const p = document.getElementById('regPass').value.trim();
    const msg = document.getElementById('regMessage');

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        
        if (res.ok) {
            msg.style.color = '#10B981';
            msg.textContent = 'Conta criada com sucesso! Faça login.';
            setTimeout(() => document.getElementById('goToLogin').click(), 1500);
            e.target.reset();
        } else {
            const data = await res.json();
            msg.style.color = 'var(--danger-color)';
            msg.textContent = data.error || 'Erro ao criar conta.';
        }
    } catch (err) { msg.textContent = 'Erro de conexão.'; }
}

function checkAuthStatus() {
    const token = localStorage.getItem('delta_token');
    if (token) {
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('appSection').classList.remove('hidden');
        loadTasks();
    } else {
        document.getElementById('appSection').classList.add('hidden');
        document.getElementById('authSection').classList.remove('hidden');
    }
}

function logout() {
    localStorage.removeItem('delta_token');
    tasksData = []; // Limpa a memória
    checkAuthStatus();
}

// ==========================================
// LÓGICA DE TAREFAS E ABAS (UI Fluida)
// ==========================================
function setupAppEvents() {
    document.getElementById('taskForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addTask();
    });

    // Lógica dos Botões das Abas
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.getAttribute('data-filter');
            renderUI();
        });
    });
}

function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('delta_token')}`
    };
}

async function loadTasks() {
    try {
        const res = await fetch(`${API_BASE}/tasks`, { headers: getHeaders() });
        if (res.status === 401) return logout();
        
        tasksData = await res.json() || [];
        renderUI();
    } catch (err) { console.error(err); }
}

// Renderiza a interface baseada no estado atual (Filtro e Dados)
function renderUI() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = ''; // Limpa a tela

    // Filtra localmente na memória
    let filteredTasks = tasksData;
    if (currentFilter === 'pending') {
        filteredTasks = tasksData.filter(t => !t.completed);
    } else if (currentFilter === 'completed') {
        filteredTasks = tasksData.filter(t => t.completed);
    }

    // Atualiza o contador de pendentes na aba
    const pendingCount = tasksData.filter(t => !t.completed).length;
    document.getElementById('countPending').textContent = pendingCount;
    document.getElementById('countPending').style.display = pendingCount > 0 ? 'inline' : 'none';

    // Estado vazio
    if (filteredTasks.length === 0) {
        let emptyMsg = "Nenhuma tarefa por aqui.";
        if (currentFilter === 'pending') emptyMsg = "Você não tem tarefas pendentes. Bom trabalho!";
        if (currentFilter === 'completed') emptyMsg = "Nenhuma tarefa concluída ainda.";
        taskList.innerHTML = `<p class="empty-state">${emptyMsg}</p>`;
        return;
    }

    // Renderiza as tarefas (DOM Seguro)
    filteredTasks.forEach(task => {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'task-content';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.checked = task.completed;
        checkbox.addEventListener('change', () => toggleTask(task.id, checkbox.checked));

        const span = document.createElement('span');
        span.className = 'task-text';
        span.textContent = task.title;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Excluir';
        deleteBtn.addEventListener('click', () => deleteTask(task.id));

        contentDiv.appendChild(checkbox);
        contentDiv.appendChild(span);
        li.appendChild(contentDiv);
        li.appendChild(deleteBtn);
        taskList.appendChild(li);
    });
}

// Ações que modificam a API e atualizam a memória local
async function addTask() {
    const input = document.getElementById('taskInput');
    const title = input.value.trim();
    if (!title) return;

    try {
        const res = await fetch(`${API_BASE}/tasks`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ title: title })
        });
        if (res.status === 401) return logout();

        if (res.ok) {
            const newTask = await res.json();
            tasksData.push(newTask); // Adiciona na memória local
            input.value = '';
            
            // Se estiver na aba "Concluídas", muda pra "Todas" ou "Pendentes" pra ver a nova tarefa
            if (currentFilter === 'completed') {
                document.querySelector('[data-filter="pending"]').click();
            } else {
                renderUI();
            }
        }
    } catch (err) { console.error(err); }
}

async function toggleTask(id, completed) {
    try {
        // Atualiza a API
        await fetch(`${API_BASE}/tasks/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ completed: completed })
        });
        
        // Atualiza a memória local
        const taskIndex = tasksData.findIndex(t => t.id === id);
        if (taskIndex > -1) {
            tasksData[taskIndex].completed = completed;
            renderUI(); // Re-renderiza instantaneamente
        }
    } catch (err) { console.error(err); }
}

async function deleteTask(id) {
    try {
        await fetch(`${API_BASE}/tasks/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        // Remove da memória local e re-renderiza
        tasksData = tasksData.filter(t => t.id !== id);
        renderUI();
    } catch (err) { console.error(err); }
}