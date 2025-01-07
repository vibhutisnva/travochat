class ChatWidget {
  constructor(options) {
    this.options = options || {};
    this.messages = [];
    this.senderName = localStorage.getItem('name') || '';
    this.email = localStorage.getItem('email') || '';
    this.session = 0;
    this.serviceStatus = false;
    this.apiBaseUrl = options.apiBaseUrl || ''; // Base URL for chat service APIs
    this.init();
  }

  // Initialize chat widget
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

  // Create chat UI
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

  // Attach event listeners
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

  // Check user by email
  async checkUser(email) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/checkUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
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

  // Register user
  async registerUser(name, email) {
    if (!name || !email) {
      alert('Please provide both name and email.');
      return;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/registerUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await response.json();
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

  // Start session
  async startSession(userId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/startSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
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

  // Register service (connect to WebSocket)
  registerService() {
    if (!this.serviceStatus) {
      this.serviceStatus = true;
      this.connectToWebSocket();
    }
  }

  // Connect to WebSocket
  connectToWebSocket() {
    const socket = new WebSocket(`${this.apiBaseUrl.replace('http', 'ws')}/connect`);
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.messages.push(message);
      this.displayMessage(message);
    };
  }

  // Display message
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

  // Send message
  async sendMessage(content) {
    if (!content.trim()) return;
    if (this.session > 0) {
      try {
        await fetch(`${this.apiBaseUrl}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            sender: this.senderName,
            session: this.session,
          }),
        });
      } catch (error) {
        console.error('Error sending message:', error);
        alert('Error sending message');
      }
    } else {
      alert('Session expired or invalid message');
    }
  }

  // Show chat view
  showChatView() {
    document.getElementById('registration-view').style.display = 'none';
    document.getElementById('chat-view').style.display = 'block';
  }
}
