# 🎮 Ft_transcendence 👾 
A real-time multiplayer game built as part of 42's curriculum.

## 📝 Project Overview  
**ft_transcendence** is a full-stack web application designed for real-time, interactive multiplayer gaming.  

Developed using modern web technologies, it features:

✅ **Real-time Multiplayer Gameplay**  
✅ **Backend Framework and Database**  
✅ **CLI Integration**  
✅ **User Authentication & Management**  
✅ **API-Driven Architecture**  
✅ **Microservices Architecture**  

## 🖥️ Game Preview  
🏓 **PengPong** — a 1v1 online or local ping-pong match  

<img src="https://github.com/user-attachments/assets/4c34198f-ceed-456b-8281-d96e00cb31af" alt="PengPong Screenshot" width="500" style="border-radius: 10px; box-shadow: 0 0 8px rgba(0,0,0,0.2);" />

## 🔧 How Does It Work ?

### 1️⃣ Clone the Repository  
Get the project on your machine:  
```bash  
git clone https://github.com/your-repo/ft_transcendence.git  
cd ft_transcendence  
```

### 2️⃣ Create the Environment


1. **Create the `.env` file** at the root of the project:

   ```bash
   touch .env
   ```

2. **Complete the `.env` file with the following information:**

   ```env
   # -------------------------
   # 🔧 PostgreSQL Configuration
   # -------------------------

   POSTGRES_DB=postgres               # PostgreSQL database name
   POSTGRES_USER=postgres             # PostgreSQL username
   POSTGRES_PASSWORD=postgres         # PostgreSQL password

   # -------------------------------
   # 🗄 Application Database Access
   # -------------------------------

   DB_HOST=postgres                   # Hostname of the PostgreSQL container (if using Docker)
   DB_PORT=5432                       # Default PostgreSQL port
   DB_USER=$POSTGRES_USER             # Reuse the PostgreSQL username
   DB_PASSWORD=$POSTGRES_PASSWORD     # Reuse the PostgreSQL password
   DB_NAME=$POSTGRES_DB               # Reuse the PostgreSQL database name

   # -------------------------
   # 🌐 Django Configuration
   # -------------------------

   ALLOWED_HOSTS=localhost,app.192.168.1.25.nip.io   # Hosts allowed to access Django
   JWT_SECRET_KEY=your-secret-key-here               # Secret key for JWT tokens (customize this)

   # -------------------------
   # 👤 Django Admin Configuration
   # -------------------------

   ADMIN_USERNAME=admin                # Django superuser username
   ADMIN_EMAIL=admin@example.com       # Django superuser email
   ADMIN_PASSWORD=admin                # Django superuser password

   # -------------------------
   # 🔐 42 API OAuth2 Configuration
   # -------------------------

   CLIENT_ID=your-client-id-42             # Client ID obtained from https://api.intra.42.fr
   CLIENT_SECRET=your-client-secret-42     # Secret associated with the Client ID
   API_URL=https://api.app.127.0.1.nip.io:8443    # Full API backend URL (use your IP)
   BASE_URL=https://app.127.0.0.1.nip.io:8443       # Frontend URL (use your IP as well)
   ```

### 4️⃣ Launch the App  
Build and start the project:  
```bash  
make
```

### 3️⃣ Access the Web Interface  
Open your browser and go to the URL:  
🌐 [https://localhost:8443](https://localhost:8443)  

### 5️⃣ Sign In 🔐  
Authenticate using:  
- 42 Intra login (OAuth2)  
- Or register a custom account  

### 6️⃣ Play the Game 🎮  
Choose from multiple game modes:  
- 🧍‍♂️ **Local Game**: Play 1v1 on the same machine  
- 🏆 **Local Tournament**: Set up a mini bracket with friends  
- 🌍 **Online Matchmaking**: Play against others online in real-time  

Have fun and may the best player win! 🏓💥  

## 🤝 Built With  
Made with ❤️ by 42 students :

- [@nspeciel](https://github.com/Darckozz)  
- [@ytaieb](https://github.com/jacobosss)  
- [@olimarti](https://github.com/olimarmite)  
- [@svydrina](https://github.com/nyagalen)  
- [@hebernard](https://github.com/LilHenri75)  
