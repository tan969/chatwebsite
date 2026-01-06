// ===== 目前登入使用者 =====
// 嘗試從 localStorage 抓取上次登入的資料，如果沒有則為 null
let currentUser = JSON.parse(localStorage.getItem('user')) || null;

// ===== DOM 元素 =====
const authPage = document.getElementById('authPage');   // 登入/註冊頁
const chatPage = document.getElementById('chatPage');   // 聊天室頁

const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');

const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regNickname = document.getElementById('regNickname');

const roomListEl = document.getElementById('roomList');
const roomNameInput = document.getElementById('roomNameInput');
const roomPasswordInput = document.getElementById('roomPasswordInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');

const currentRoomTitle = document.getElementById('currentRoomTitle');
const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const imageInput = document.getElementById('imageInput');
const chatForm = document.getElementById('chatForm');

// [移至上方] 個人資料與群組管理相關 DOM (避免 ReferenceError)
const userMenu = document.getElementById('userMenu');
const headerAvatar = document.getElementById('headerAvatar');
const profileModal = document.getElementById('profileModal');
const previewAvatar = document.getElementById('previewAvatar');
const avatarUpdateInput = document.getElementById('avatarUpdateInput');
const editNickname = document.getElementById('editNickname');

const roomSettingsBtn = document.getElementById('roomSettingsBtn');
const groupSettingsModal = document.getElementById('groupSettingsModal');
const memberListEl = document.getElementById('memberList');
const memberCountEl = document.getElementById('memberCount');
const deleteGroupBtn = document.getElementById('deleteGroupBtn');
const settingsRoomTitle = document.getElementById('settingsRoomTitle');
const generalSettingsEl = document.getElementById('generalSettings');

// 內建一個預設頭貼
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTMS43OSA0LThzLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYzAtMi42Ni01LjMzLTQtOC00eiIvPjwvc3ZnPg==';
// ===== Socket.io 連線 =====
const socket = io();

// ===== 登入 / 註冊函式 =====
async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) return alert('請輸入帳號與密碼');

  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();

  if (!data.ok) return alert(data.msg);

  currentUser = data.user;
  const userForStorage = { ...currentUser, avatar: null }; 
  localStorage.setItem('user', JSON.stringify(userForStorage));

  updateHeaderAvatar();

  authPage.style.display = 'none';
  chatPage.style.display = 'flex';
  // [新增] 登入成功後，直接進入公共大廳
  socket.emit('enterLobby', currentUser);
  // [新增] 登入後自動進入大廳
  socket.emit('enterLobby', currentUser);
}

async function register() {
  const email = regEmail.value.trim();
  const password = regPassword.value.trim();
  const nickname = regNickname.value.trim();

  if (!email || !password || !nickname) return alert('請完整填寫註冊資料');

  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, nickname })
  });
  const data = await res.json();

  if (!data.ok) return alert(data.msg);

  alert('註冊成功，請登入');
}

// ===== 聊天狀態 =====
let currentRoom = null;
let isCurrentRoomAdmin = false;
let selectedRoomId = null;

// ===== 工具函式 =====
function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

// 渲染房間列表
// 渲染房間列表 (修改：已加入的成員點擊直接進入)
function renderRoomList(rooms) {
  roomListEl.innerHTML = '';
  rooms.forEach((room) => {
    const li = document.createElement('li');
    li.className = 'room-item';
    
    // 判斷自己是否已經是成員 (透過後端傳來的 members 陣列)
    const isMember = currentUser && room.members && room.members.includes(currentUser.email);
    
    // 如果已經加入，就不顯示鎖頭
    const lockIcon = (room.hasPassword && !isMember) ? ' 🔒' : ''; 
    // 簡單標示已加入
    const memberStatus = isMember ? ' (已加入)' : ''; 
    // 修正：原本 script.js 寫 userCount，但 index.js 是傳 memberCount
    const countText = typeof room.memberCount === 'number' ? `（${room.memberCount}）` : '';
    
    li.textContent = `${room.name}${lockIcon}${memberStatus}${countText}`;
    
    // 根據是否為成員，決定點擊行為
    if (isMember) {
        // [情況 A] 已經是成員 (包含被邀請)：點擊直接進入！
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
            // 直接發送 joinRoom，不需要密碼
            // 使用 realName 確保對應到正確的房間 Key
            const targetRoomId = room.realName || room.name;
            socket.emit('joinRoom', { roomName: targetRoomId, password: '', user: currentUser });
        });
    } else {
        // [情況 B] 尚未加入：點擊後只是填入輸入框，等待使用者輸入密碼按加入
        li.addEventListener('click', () => { 
            roomNameInput.value = room.name; 
            selectedRoomId = room.realName || room.name;
        });
    }

    // 標示目前所在的房間 (比對顯示名稱或真實ID)
    if (room.name === currentRoom || room.realName === currentRoom) {
        li.classList.add('active');
    }
    
    roomListEl.appendChild(li);
  });
}

// ===== 新增訊息到 UI (LINE/IG 風格) =====
function addMessageToUI(message) {

  if (message.type === 'system') {
    const systemDiv = document.createElement('div');
    systemDiv.className = 'message-system';
    systemDiv.textContent = message.content;
    messagesEl.appendChild(systemDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return; 
  }

  const isSelf = currentUser && message.user === currentUser.nickname; // 注意：這裡如果 message.user 是群組暱稱，判斷可能會有誤差，但暫時維持
  
  const row = document.createElement('div');
  row.className = `message-row ${isSelf ? 'self' : 'other'}`;
  row.dataset.id = message.id;
  row.dataset.senderEmail = message.senderEmail;

  if (!isSelf) {
    const avatarImg = document.createElement('img');
    avatarImg.className = 'message-avatar';
    avatarImg.src = message.avatar || DEFAULT_AVATAR; 
    row.appendChild(avatarImg);
  }

  const contentGroup = document.createElement('div');
  contentGroup.className = 'message-content';

  if (!isSelf) {
    const nickname = document.createElement('div');
    nickname.className = 'message-nickname';
    nickname.textContent = message.user;
    contentGroup.appendChild(nickname);
  }

  const bubbleContainer = document.createElement('div');
  bubbleContainer.className = 'bubble-container';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (message.type === 'image') {

    bubble.classList.add('image-bubble');
    
    const img = document.createElement('img');
    img.src = message.content;
    img.className = 'message-image';
    bubble.appendChild(img);
  } 
  else if (message.type === 'file') {
    const link = document.createElement('a');
    link.href = message.content;
    link.download = message.fileName;
    link.textContent = `📄 ${message.fileName}`;
    link.className = 'message-file-link';
    bubble.appendChild(link);
  } 
  else {
    bubble.textContent = message.content;
  }
  
  if (isSelf) {
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = () => {
        if(!currentRoom) return;
        socket.emit('deleteMessage', { roomName: currentRoom, messageId: message.id });
    };
    bubbleContainer.appendChild(delBtn); 
  }

  const timeSpan = document.createElement('span');
  timeSpan.className = 'message-time';
  timeSpan.textContent = formatTime(message.time);

  bubbleContainer.appendChild(bubble);
  bubbleContainer.appendChild(timeSpan);
  contentGroup.appendChild(bubbleContainer);
  row.appendChild(contentGroup);

  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 渲染歷史訊息
function renderMessages(messages) {
  messagesEl.innerHTML = '';
  messages.forEach(addMessageToUI);
}

// ===== Socket.io 接收事件 =====
socket.on('roomList', renderRoomList);

socket.on('createRoomResult', (res) => {
  alert(res.msg);
  if (res.ok && res.displayName) {
      roomNameInput.value = res.displayName;
  }
});

// [修正] 移除原本舊的 joinRoomResult，只保留下面那個包含群組功能的版本

socket.on('newMessage', ({ roomName, message }) => {
  if (roomName !== currentRoom) return;
  addMessageToUI(message);
});

socket.on('messageDeleted', ({ roomName, messageId }) => {
  if (roomName !== currentRoom) return;
  const el = document.querySelector(`.message-row[data-id="${messageId}"]`);
  if (el) el.remove();
});

// ===== 前端操作事件 =====

// 建立房間
createRoomBtn.addEventListener('click', () => {
  if (!currentUser) return alert('請先登入');
  const roomName = roomNameInput.value.trim();
  const password = roomPasswordInput.value;
  if (!roomName) return alert('請輸入房間名稱');
  socket.emit('createRoom', { roomName, password, creatorEmail: currentUser.email });
});

// 當使用者手動打字時，清空暫存的 ID (因為他可能想建立新房間或搜尋別的)
roomNameInput.addEventListener('input', () => {
  selectedRoomId = null;
});

// 加入房間
joinRoomBtn.addEventListener('click', () => {
  if (!currentUser) return alert('請先登入');
  
  // 取得輸入框的值
  const inputName = roomNameInput.value.trim();
  if (!inputName) return alert('請先輸入房間名稱');

  let targetRoomName = inputName;
  if (selectedRoomId) {
      targetRoomName = selectedRoomId;
  }

  const password = roomPasswordInput.value;
  socket.emit('joinRoom', { roomName: targetRoomName, password, user: currentUser });
  
  // 送出後清空暫存，避免影響下次
  selectedRoomId = null;
});

// 送出文字訊息
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentRoom) return alert('請先加入房間');
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('sendMessage', { roomName: currentRoom, type: 'text', content: text });
  messageInput.value = '';
});

// 上傳圖片
imageInput.addEventListener('change', () => {
  if (!currentRoom) return alert('請先加入房間再傳圖片');
  const file = imageInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    socket.emit('sendMessage', { roomName: currentRoom, type: 'image', content: e.target.result });
  };
  reader.readAsDataURL(file);
  imageInput.value = '';
});

// ===== 切換登入 / 註冊模式 =====
function toggleAuthMode() {
  const loginSection = document.getElementById('loginSection');
  const registerSection = document.getElementById('registerSection');
  const title = document.querySelector('.auth-header h2');
  const subtitle = document.querySelector('.auth-header p');

  if (loginSection.style.display === 'none') {
    loginSection.style.display = 'block';
    registerSection.style.display = 'none';
    title.textContent = '歡迎使用聊天室';
    subtitle.textContent = '請輸入您的帳號密碼';
  } else {
    loginSection.style.display = 'none';
    registerSection.style.display = 'block';
    title.textContent = '建立新帳號';
    subtitle.textContent = '      ';
  }
}

// ===== 個人資料與頭貼功能 =====

// 更新 Header 上的頭貼函式
function updateHeaderAvatar() {
  if (currentUser) {
    userMenu.style.display = 'block'; 
    headerAvatar.src = currentUser.avatar || DEFAULT_AVATAR;
  } else {
    userMenu.style.display = 'none';
  }
}

// 程式啟動時檢查一次
if (currentUser) {
  updateHeaderAvatar();
  socket.emit('enterLobby', currentUser);
}

// 開啟編輯視窗
function openProfileModal() {
  if (!currentUser) return;
  profileModal.style.display = 'flex';
  editNickname.value = currentUser.nickname; 
  previewAvatar.src = currentUser.avatar || DEFAULT_AVATAR;
}

// 關閉編輯視窗
function closeProfileModal() {
  profileModal.style.display = 'none';
}

// 當使用者選擇新圖片時 (預覽功能)
avatarUpdateInput.addEventListener('change', () => {
  const file = avatarUpdateInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    previewAvatar.src = e.target.result; 
  };
  reader.readAsDataURL(file);
});

// 儲存變更 (送出到後端)
async function saveProfile() {
  const newNickname = editNickname.value.trim();
  const newAvatar = previewAvatar.src; 

  if (!newNickname) return alert('暱稱不能為空');

  const res = await fetch('/api/updateProfile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: currentUser.email,
      nickname: newNickname,
      avatar: newAvatar === DEFAULT_AVATAR ? null : newAvatar 
    })
  });

  const data = await res.json();

  if (data.ok) {
    closeProfileModal();
    currentUser = data.user;
    const userForStorage = { ...currentUser, avatar: null }; 
    localStorage.setItem('user', JSON.stringify(userForStorage));
    updateHeaderAvatar();
    alert('個人資料已更新！');
  } else {
    alert('更新失敗：' + data.msg);
  }
}

// ===== 群組管理功能 =====

// 監聽房間標題更新 (改名後即時變更 Header)
socket.on('roomInfoUpdated', ({ newName }) => {
    if (currentRoomTitle) currentRoomTitle.textContent = `目前房間：${newName}`;
    if (settingsRoomTitle) settingsRoomTitle.textContent = `群組設定：${newName}`;
});

// ===== 即時同步頭貼（更新舊訊息）=====
socket.on('userAvatarUpdated', ({ email, avatar }) => {
  const newAvatar = avatar || DEFAULT_AVATAR;

  // 1️⃣ 更新聊天室中「已顯示的舊訊息」
  document.querySelectorAll('.message-row').forEach(row => {
    // 只處理別人的訊息（因為自己沒頭貼）
    if (row.classList.contains('other')) {
      const img = row.querySelector('.message-avatar');
      if (!img) return;

      // 利用 data-sender-email（下面會補）
      if (row.dataset.senderEmail === email) {
        img.src = newAvatar;
      }
    }
  });

  // 2️⃣ 如果是自己，也同步更新 Header
  if (currentUser && currentUser.email === email) {
    currentUser.avatar = avatar;
    updateHeaderAvatar();
  }
});


// [新增] 接收大廳資料
socket.on('enterLobbyResult', (res) => {
  currentRoom = res.roomName;
  
  // 更新標題
  if (currentRoomTitle) currentRoomTitle.textContent = res.displayName;
  
  // 渲染訊息
  renderMessages(res.messages || []);
  
  // 大廳隱藏設定按鈕 (因為公共區域不能改名或踢人)
  if (roomSettingsBtn) roomSettingsBtn.style.display = 'none';

  if (backToLobbyBtn) backToLobbyBtn.style.display = 'none';
  
  // 清空左側選中的房間列表樣式
  document.querySelectorAll('.room-item').forEach(el => el.classList.remove('active'));
});



// [正確] 加入房間成功時，更新標題顯示名稱 (整合版)
socket.on('joinRoomResult', (res) => {
  if (!res.ok) return alert(res.msg);
  
  roomPasswordInput.value = '';
  currentRoom = res.roomName;
  currentRoomTitle.textContent = `目前房間：${res.displayName || res.roomName}`;
  renderMessages(res.messages || []);
  
  // 顯示設定按鈕
  roomSettingsBtn.style.display = 'block'; 
  isCurrentRoomAdmin = res.isAdmin;

  if (backToLobbyBtn) backToLobbyBtn.style.display = 'block';
});

// 點擊設定按鈕
roomSettingsBtn.addEventListener('click', () => {
  if (!currentRoom) return;
  groupSettingsModal.style.display = 'flex';
  socket.emit('getRoomSettings', currentRoom);
});

// 接收設定資料
// 接收設定資料
socket.on('roomSettingsData', (data) => {
  settingsRoomTitle.textContent = `群組設定：${data.displayName || data.roomName}`;
  const members = data.members;
  const adminEmail = data.admin;
  
  memberCountEl.textContent = members.length;
  
  // [修改] 1. 清空並渲染「一般設定區」（改名 + 邀請），放到 generalSettingsEl
  if (generalSettingsEl) {
      generalSettingsEl.innerHTML = '';
      
      // (A) 更改群組名稱
      const nameSection = document.createElement('div');
      nameSection.style.marginBottom = '15px';
      nameSection.style.padding = '10px';
      nameSection.style.background = '#f9fafb';
      nameSection.style.borderRadius = '6px';
      nameSection.innerHTML = `
        <label style="font-size:12px; color:#666; display:block; margin-bottom:5px;">更改群組名稱</label>
        <div style="display:flex; gap:5px;">
            <input type="text" id="groupNameInput" value="${data.displayName || data.roomName}" style="flex:1; padding:6px; border:1px solid #ddd; border-radius:4px;">
            <button onclick="updateGroupName()" style="cursor:pointer; padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:4px;">儲存</button>
        </div>
      `;
      generalSettingsEl.appendChild(nameSection);
    
      // (B) [修改] 邀請成員 (改為輸入暱稱)
      const inviteSection = document.createElement('div');
      inviteSection.style.marginBottom = '15px';
      inviteSection.style.padding = '10px';
      inviteSection.style.background = '#f9fafb';
      inviteSection.style.borderRadius = '6px';
      inviteSection.innerHTML = `
        <label style="font-size:12px; color:#666; display:block; margin-bottom:5px;">邀請成員 (輸入暱稱)</label>
        <div style="display:flex; gap:5px;">
            <input type="text" id="inviteNickInput" placeholder="輸入對方暱稱" style="flex:1; padding:6px; border:1px solid #ddd; border-radius:4px;">
            <button onclick="inviteMember()" style="cursor:pointer; background:#10b981; color:white; border:none; border-radius:4px; padding:6px 12px;">邀請</button>
        </div>
      `;
      generalSettingsEl.appendChild(inviteSection);
  }

  // [修改] 2. 清空並渲染「成員列表區」 (這裡現在只放成員列表)
  memberListEl.innerHTML = '';
  
  isCurrentRoomAdmin = (currentUser && currentUser.email === adminEmail);
  deleteGroupBtn.style.display = isCurrentRoomAdmin ? 'inline-block' : 'none';

  members.forEach(m => {
    const li = document.createElement('li');
    li.className = 'member-item';
    
    const isAdmin = m.email === adminEmail;
    const displayName = m.groupNickname || m.nickname;
    const avatarSrc = m.avatar || DEFAULT_AVATAR;

    let html = `
      <div class="member-info">
        <img src="${avatarSrc}" class="member-avatar">
        <div class="member-name-group">
          <input type="text" value="${displayName}" class="nickname-input" 
                 onchange="changeGroupNick('${m.email}', this.value)">
          ${m.groupNickname ? `<span class="real-name">原名: ${m.nickname}</span>` : ''}
        </div>
        ${isAdmin ? '<span class="admin-badge">管理員</span>' : ''}
      </div>
    `;

    if (isCurrentRoomAdmin && !isAdmin) {
      html += `<button class="kick-btn" onclick="kickMember('${m.email}')">移除</button>`;
    }
    
    li.innerHTML = html;
    memberListEl.appendChild(li);
  });
});

// ===== 功能函式 (綁定到 window 以便 HTML 呼叫) =====

window.updateGroupName = function() {
    const newName = document.getElementById('groupNameInput').value.trim();
    if(newName) socket.emit('changeGroupName', { roomName: currentRoom, newName });
};

window.inviteMember = function() {
    // [修改] 改抓 inviteNickInput (暱稱輸入框)
    const input = document.getElementById('inviteNickInput');
    if (!input) return; 
    
    const nickname = input.value.trim();
    
    if(nickname) {
        // [修改] 發送 targetNickname 給後端
        socket.emit('inviteMember', { roomName: currentRoom, targetNickname: nickname });
        input.value = ''; 
        alert('已發送邀請 (若暱稱正確且對方存在)');
    } else {
        alert('請輸入暱稱');
    }
};

window.changeGroupNick = function(targetEmail, newName) {
  if (!newName.trim()) return;
  socket.emit('updateMemberNickname', { roomName: currentRoom, targetEmail, newNickname: newName });
};

window.kickMember = function(targetEmail) {
  if(!confirm('確定要移除此成員嗎？')) return;
  socket.emit('kickMember', { roomName: currentRoom, targetEmail });
};

window.leaveGroup = function() {
  if(!confirm('確定要退出此群組嗎？')) return;
  socket.emit('leaveGroup', { roomName: currentRoom });
};

window.deleteGroup = function() {
  // 改成簡單的 confirm 視窗，按「確定」回傳 true，按「取消」回傳 false
  if (confirm('警告：解散後所有訊息將無法復原！\n確定要解散聊天室嗎？')) {
    socket.emit('deleteGroup', { roomName: currentRoom });
  }
};

// 監聽更新
socket.on('memberListUpdated', () => {
  if (groupSettingsModal.style.display === 'flex') {
    socket.emit('getRoomSettings', currentRoom);
  }
});
socket.on('leftGroupSuccess', () => {
  alert('你已退出群組');
  socket.emit('enterLobby', currentUser);
});
socket.on('groupDeleted', () => {
  alert('群組已被解散');
  socket.emit('enterLobby', currentUser);
});

// ===== [修正] 返回按鈕邏輯 (放在檔案最下方確保安全) =====
const backBtn = document.getElementById('backToLobbyBtn');
if (backBtn) {
  // 先移除舊的避免重複 (雖然重新整理後不會有這問題，但好習慣)
  backBtn.replaceWith(backBtn.cloneNode(true));
  const newBackBtn = document.getElementById('backToLobbyBtn');

  newBackBtn.addEventListener('click', () => {
    console.log('🔙 返回按鈕被點擊');
    // 優先使用全域變數，若無則嘗試從 localStorage 抓
    const userToUse = currentUser || JSON.parse(localStorage.getItem('user'));

    if (userToUse) {
      socket.emit('enterLobby', userToUse);
    } else {
      alert('請先登入');
      location.reload();
    }
  });
} else {
  console.error('❌ 找不到返回按鈕 (backToLobbyBtn)');
}


// ===== [新增] 處理邀請通知邏輯 =====

const inviteModal = document.getElementById('inviteModal');
const inviteText = document.getElementById('inviteText');
const acceptBtn = document.getElementById('acceptBtn');
const declineBtn = document.getElementById('declineBtn');

let pendingInviteRoom = null; // 暫存目前收到的邀請房間

// 1. 收到邀請通知 -> 顯示彈窗
if (socket) {
  socket.on('receiveInvitation', ({ roomName, roomDisplayName, inviter }) => {
    pendingInviteRoom = roomName;
    if (inviteText && inviteModal) {
      inviteText.innerHTML = `<strong>${inviter}</strong> 邀請你加入<br>「${roomDisplayName}」`;
      inviteModal.style.display = 'flex';
    }
  });

  // 4. 後端確認加入成功 -> 自動跳轉進入房間
  socket.on('inviteAccepted', ({ roomName }) => {
    // 直接觸發 joinRoom，因為後端已經把我們加進名單了，所以密碼留空即可
    socket.emit('joinRoom', { roomName, password: '', user: currentUser });
    if (inviteModal) inviteModal.style.display = 'none';
  });
}

// 2. 按下「加入」 -> 告訴後端我接受了
if (acceptBtn) {
  acceptBtn.addEventListener('click', () => {
    if (pendingInviteRoom) {
      socket.emit('acceptInvite', { roomName: pendingInviteRoom });
    }
    // 注意：這裡不直接關視窗，等收到 inviteAccepted 再關，或是在上面關
  });
}

// 3. 按下「拒絕」 -> 關閉視窗，什麼都不做
if (declineBtn) {
  declineBtn.addEventListener('click', () => {
    if (inviteModal) inviteModal.style.display = 'none';
    pendingInviteRoom = null;
  });
}