import React, { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { LogOut, Search, Send, User as UserIcon, MessageSquare, Image as ImageIcon, ChevronLeft } from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socket';

interface Chat {
  _id: string;
  isGroup: boolean;
  participants: any[];
  lastMessage?: any;
}

interface Message {
  _id: string;
  conversationId: string;
  content: string;
  type?: string;
  sender: any; // could be string ID or populated object depending on backend
  createdAt: string;
}

interface UserResult {
  _id: string;
  username: string;
  displayName: string;
  email: string;
}

export default function Dashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Re-fetch chats when component mounts
  useEffect(() => {
    fetchChats();
  }, []);

  // Socket listeners
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleNewMessage = (msg: Message) => {
      // 1. If it belongs to active chat, show it
      setActiveChat((currentActiveChat) => {
        if (currentActiveChat && currentActiveChat._id === msg.conversationId) {
          setMessages((prev) => {
            // Prevent duplicates
            if (prev.find(m => m._id === msg._id)) return prev;
            return [...prev, msg];
          });
          scrollToBottom();
        }
        return currentActiveChat;
      });

      // 2. Update the sidebar chats list with the new message
      setChats((prevChats) => {
        const chatExists = prevChats.find(c => c._id === msg.conversationId);
        
        let newChats = [...prevChats];
        if (chatExists) {
          newChats = newChats.map(c => 
            c._id === msg.conversationId 
              ? { ...c, lastMessage: { content: msg.content, createdAt: msg.createdAt } } 
              : c
          );
        } else {
          // If a completely new chat started by someone else, fetch chats again
          fetchChats(); 
        }

        // Sort by latest message
        return newChats.sort((a, b) => {
          const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return timeB - timeA;
        });
      });
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, []);

  // Fetch messages when active chat changes
  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat._id);
    }
  }, [activeChat]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async () => {
    setIsSearching(true);
    try {
      const res = await api.get(`/users?q=${searchQuery}`);
      setSearchResults(res.data.data.users || []);
    } catch (err) {
      console.error('Failed to search users', err);
    } finally {
      setIsSearching(false);
    }
  };

  const startOrGetChat = async (participantId: string) => {
    try {
      const res = await api.post('/chats', { participantId });
      const newChat = res.data.data;
      setActiveChat(newChat);
      setSearchQuery('');
      setSearchResults([]);
      fetchChats(); // Refresh the list to include this chat
    } catch (err) {
      console.error('Failed to start chat', err);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await api.get('/chats');
      setChats(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch chats', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await api.get(`/chats/${chatId}/messages`);
      // FIX: The backend returns res.data.data.messages, not items
      const fetchedMessages = res.data.data.messages || [];
      setMessages(fetchedMessages.reverse());
      scrollToBottom();
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat) return;

    const socket = socketService.getSocket();
    if (socket) {
      const tempContent = newMessage;
      setNewMessage('');
      
      socket.emit('message:send', {
        conversationId: activeChat._id,
        content: tempContent,
        type: 'text'
      }, (response: any) => {
        if (response.success) {
          const sentMsg = response.message;
          setMessages((prev) => [...prev, sentMsg]);
          scrollToBottom();
          
          // Update sidebar for my own message
          setChats((prevChats) => {
            return prevChats.map(c => 
              c._id === activeChat._id 
                ? { ...c, lastMessage: { content: sentMsg.content, createdAt: sentMsg.createdAt } } 
                : c
            ).sort((a, b) => {
              const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
              const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
              return timeB - timeA;
            });
          });
        } else {
          console.error('Failed to send message via socket:', response.error);
          setNewMessage(tempContent);
        }
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;
    
    // Reset input
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      const socket = socketService.getSocket();
      
      if (socket) {
        socket.emit('message:send', {
          conversationId: activeChat._id,
          content: base64String,
          type: 'image'
        }, (response: any) => {
          if (response.success) {
            const sentMsg = response.message;
            setMessages((prev) => [...prev, sentMsg]);
            scrollToBottom();
            
            // Update sidebar for my own message
            setChats((prevChats) => {
              return prevChats.map(c => 
                c._id === activeChat._id 
                  ? { ...c, lastMessage: { content: '📷 Image', createdAt: sentMsg.createdAt } } 
                  : c
              ).sort((a, b) => {
                const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
                const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
                return timeB - timeA;
              });
            });
          } else {
            console.error('Failed to send image via socket:', response.error);
          }
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Helper to format timestamps nicely
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="app-container" style={{ padding: '1.5rem', backgroundColor: 'var(--bg-base)' }}>
      <div className="glass-panel" style={{ width: '100%', display: 'flex', overflow: 'hidden' }}>
        
        {/* Sidebar */}
        <div className={`chat-sidebar ${activeChat ? 'hidden-on-mobile' : ''}`} style={{ width: '320px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--glass-bg)' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontWeight: 'bold', color: 'white' }}>{user?.displayName?.charAt(0).toUpperCase()}</span>
              </div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Chats</h2>
            </div>
            <button className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%' }} onClick={handleLogout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
          
          <div style={{ padding: '1rem' }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Search users to chat..." 
                  style={{ paddingLeft: '2.5rem', padding: '0.6rem 0.6rem 0.6rem 2.5rem', borderRadius: '20px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Search Results View */}
            {searchQuery.length > 0 ? (
              isSearching ? (
                <div className="flex-center" style={{ padding: '2rem' }}><div className="spinner"></div></div>
              ) : searchResults.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found.</p>
              ) : (
                <>
                  <p style={{ padding: '0.5rem 1.5rem', margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Search Results</p>
                  {searchResults.map(resultUser => {
                    if (resultUser._id === user?._id) return null;
                    
                    return (
                      <div 
                        key={resultUser._id}
                        onClick={() => startOrGetChat(resultUser._id)}
                        style={{ 
                          padding: '1rem 1.5rem', 
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background-color var(--transition-fast)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserIcon size={20} color="var(--primary)" />
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {resultUser.displayName || resultUser.username}
                            </h4>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>@{resultUser.username}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            ) : (
              /* Existing Chats View */
              loading ? (
                <div className="flex-center" style={{ padding: '2rem' }}><div className="spinner"></div></div>
              ) : chats.length === 0 ? (
                <div className="flex-center" style={{ flexDirection: 'column', padding: '3rem 1.5rem', textAlign: 'center' }}>
                  <MessageSquare size={32} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No conversations yet.</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>Search for a user to start chatting.</p>
                </div>
              ) : (
                chats.map(chat => {
                  const otherParticipant = chat.participants.find((p: any) => p._id !== user?._id);
                  const isActive = activeChat?._id === chat._id;
                  
                  return (
                    <div 
                      key={chat._id}
                      onClick={() => setActiveChat(chat)}
                      style={{ 
                        padding: '1rem 1.5rem', 
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isActive ? 'var(--bg-surface-hover)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                        transition: 'all var(--transition-fast)'
                      }}
                      onMouseOver={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)' }}
                      onMouseOut={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <UserIcon size={24} color="var(--primary)" />
                        </div>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {chat.isGroup ? 'Group Chat' : otherParticipant?.displayName || otherParticipant?.username || 'Unknown User'}
                            </h4>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {formatTime(chat.lastMessage?.createdAt || chat.lastMessage?.timestamp)}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {chat.lastMessage?.content?.startsWith('data:image') ? '📷 Image' : (chat.lastMessage?.content || 'Started a new conversation')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              )
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={`chat-main ${!activeChat ? 'hidden-on-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          {activeChat ? (
            <>
              {/* Chat Header */}
              <div style={{ padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--glass-bg)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                  className="btn btn-secondary mobile-only" 
                  style={{ padding: '0.5rem', borderRadius: '50%', marginRight: '-0.25rem' }} 
                  onClick={() => setActiveChat(null)} 
                  title="Back to chats"
                >
                  <ChevronLeft size={20} />
                </button>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserIcon size={20} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    {activeChat.isGroup ? 'Group Chat' : (activeChat.participants.find((p: any) => p._id !== user?._id)?.displayName || 'Chat')}
                  </h3>
                </div>
              </div>

              {/* Messages Area */}
              <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '2rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1rem',
                // Texting app background pattern (subtle)
                backgroundImage: 'radial-gradient(var(--border-color) 1px, transparent 1px)',
                backgroundSize: '20px 20px'
              }}>
                {messages.map((msg, index) => {
                  // The backend might return sender as an object or just an ID
                  const senderId = typeof msg.sender === 'object' ? msg.sender?._id : msg.sender;
                  const isMe = senderId === user?._id;
                  
                  // Show time only if significant gap or last message
                  const showTime = true; 

                  return (
                    <div key={msg._id || index} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '70%',
                        padding: msg.type === 'image' ? '0.5rem' : '0.85rem 1.15rem',
                        borderRadius: '16px',
                        borderBottomRightRadius: isMe ? '4px' : '16px',
                        borderBottomLeftRadius: isMe ? '16px' : '4px',
                        backgroundColor: isMe ? 'var(--primary)' : 'var(--bg-surface)',
                        color: isMe ? 'white' : 'var(--text-primary)',
                        boxShadow: 'var(--shadow-sm)',
                        position: 'relative'
                      }}>
                        {msg.type === 'image' ? (
                          <img src={msg.content} alt="sent image" style={{ maxWidth: '100%', borderRadius: '12px', display: 'block' }} />
                        ) : (
                          <p style={{ margin: 0, wordBreak: 'break-word', fontSize: '0.95rem', lineHeight: 1.4 }}>{msg.content}</p>
                        )}
                        
                        {showTime && (
                          <span style={{ 
                            fontSize: '0.65rem', 
                            opacity: 0.7, 
                            display: 'block', 
                            textAlign: 'right', 
                            marginTop: '0.4rem',
                            userSelect: 'none'
                          }}>
                            {formatTime(msg.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--glass-bg)' }}>
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleImageUpload} 
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ borderRadius: '50%', width: '46px', height: '46px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                    onClick={() => fileInputRef.current?.click()}
                    title="Send Photo"
                  >
                    <ImageIcon size={20} color="var(--text-muted)" />
                  </button>
                  <input
                    type="text"
                    className="input-field"
                    style={{ flex: 1, margin: 0, borderRadius: '24px', padding: '0.85rem 1.25rem', backgroundColor: 'var(--bg-surface)' }}
                    placeholder="Message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ borderRadius: '50%', width: '46px', height: '46px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                    disabled={!newMessage.trim()}
                  >
                    <Send size={18} style={{ marginLeft: '-2px' }} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-center" style={{ flex: 1, flexDirection: 'column', color: 'var(--text-muted)' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <MessageSquare size={36} color="var(--primary)" opacity={0.8} />
              </div>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Your Messages</h2>
              <p style={{ fontSize: '1rem', opacity: 0.8, maxWidth: '300px', textAlign: 'center' }}>
                Select a conversation or search for a user to start texting.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
