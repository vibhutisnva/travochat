class ChatService {
  constructor(apiBaseUrl) {
    this.apiBaseUrl = apiBaseUrl || '';
    this.stompClient = null;
    this.messageListeners = [];
  }

  connect() {
    const socket = new SockJS(`${this.apiBaseUrl}/ws`);
    this.stompClient = Stomp.over(socket);
    this.stompClient.connect({}, () => {
      console.log('Connected to WebSocket');
      this.stompClient.subscribe('/topic/messages', (message) => {
        const parsedMessage = JSON.parse(message.body);
        this.messageListeners.forEach((listener) => listener(parsedMessage));
      });
    });
  }

  onMessage(callback) {
    if (typeof callback === 'function') {
      this.messageListeners.push(callback);
    }
  }

  async registerUser(name, email) {
    const response = await fetch(`${this.apiBaseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });
    return response.json();
  }

  async startSession(userId) {
    const response = await fetch(`${this.apiBaseUrl}/start?userId=${userId}`);
    return response.json();
  }

  async checkUser(email) {
    const response = await fetch(`${this.apiBaseUrl}/check?email=${email}`);
    return response.json();
  }

  async sendMessage(content, sender, session) {
    const message = { content, sender, session };
    this.stompClient.send('/app/chat', {}, JSON.stringify(message));
  }
}

class ChatWidget {
  constructor(options) {
    this.options = options || {};
    this.messages = [];
    this.senderName = localStorage.getItem('name') || '';
    this.email = localStorage.getItem('email') || '';
    this.session = 0;
    this.serviceStatus = false;
    this.apiBaseUrl = options.apiBaseUrl || '';
    this.chatService = new ChatService(this.apiBaseUrl);
    this.init();
  }

  init() {
    this.createChatUI();
    this.attachEventListeners();

    if (this.email) {
      this.checkUser(this.email);
    }
    if (!this.session) {
      const id = localStorage.getItem('id') || '0';
      if (parseInt(id) > 0) {
        this.startSession(id);
      }
    }
    this.registerService();
  }

  createChatUI() {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chat-widget';
    chatContainer.innerHTML = `
      <div id="registration-view" class="chat-container">
        <h1>Chat Application</h1>
        <input id="nameInput" type="text" placeholder="Enter your name to start chatting" />
        <input id="emailInput" type="email" placeholder="Enter your email" />
        <button id="registerButton">Submit</button>
      </div>

      <div id="chat-view" class="chat-container" style="display: none;">
        <h1>Chat Application</h1>
        <div class="chat-messages" id="chatMessages"></div>
        <div class="chat-input">
          <input id="messageInput" type="text" placeholder="Type your message" />
          <button id="sendButton">Send</button>
        </div>
      </div>
    `;
    document.body.appendChild(chatContainer);
  }

  attachEventListeners() {
    const registerButton = document.getElementById('registerButton');
    registerButton.addEventListener('click', () => {
      const nameInput = document.getElementById('nameInput').value;
      const emailInput = document.getElementById('emailInput').value;
      this.registerUser(nameInput, emailInput);
    });

    const sendButton = document.getElementById('sendButton');
    sendButton.addEventListener('click', () => {
      const messageInput = document.getElementById('messageInput').value;
      this.sendMessage(messageInput);
      document.getElementById('messageInput').value = '';
    });
  }

  async checkUser(email) {
    try {
      const data = await this.chatService.checkUser(email);
      if (data.data.session > 0) {
        this.session = data.data.session;
        localStorage.setItem('id', data.data.userId);
        this.showChatView();
      }
    } catch (error) {
      console.error('Error checking user:', error);
      alert('Error checking user');
    }
  }

  async registerUser(name, email) {
    if (!name || !email) {
      alert('Please provide both name and email.');
      return;
    }

    try {
      const data = await this.chatService.registerUser(name, email);
      if (data.statusCode === 200) {
        this.senderName = name;
        this.email = email;
        localStorage.setItem('name', name);
        localStorage.setItem('email', email);
        this.session = data.data.session;
        this.startSession(data.data.id);
        this.showChatView();
      }
      alert(data.message);
    } catch (error) {
      console.error('Error registering user:', error);
      alert('Error registering user');
    }
  }

  async startSession(userId) {
    try {
      const data = await this.chatService.startSession(userId);
      if (data.statusCode === 200) {
        this.session = data.session;
        localStorage.setItem('id', data.userId);
        this.registerService();
      }
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Error starting session');
    }
  }

  registerService() {
    if (!this.serviceStatus) {
      this.serviceStatus = true;
      this.connectToWebSocket();
    }
  }

  connectToWebSocket() {
    this.chatService.connect();
    this.chatService.onMessage((message) => {
      this.messages.push(message);
      this.displayMessage(message);
    });
  }

  displayMessage(message) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = message.sender === this.senderName ? 'chat-message-sender' : 'chat-message-receiver';
    messageElement.innerHTML = `
      <p>${message.sender === this.senderName ? message.content : `${message.sender}: ${message.content}`}</p>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async sendMessage(content) {
    if (!content.trim()) return;
    if (this.session > 0) {
      try {
        await this.chatService.sendMessage(content, this.senderName, this.session);
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message');
      }
    } else {
      alert('Session expired or invalid message');
    }
  }

  showChatView() {
    document.getElementById('registration-view').style.display = 'none';
    document.getElementById('chat-view').style.display = 'block';
  }
}
