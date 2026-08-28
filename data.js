/* data.js — Fake API Service */


let mockConversations = [
  {
    id: "conv-1",
    name: "Sarah Doe",
    avatar: "https://i.pravatar.cc/150?img=47",
    propertyTitle: "Inquiry: Cedar Hollow Lane, Austin, TX",
    isUnread: true,
    isArchived: false,
    messages: [
      { id: "m1", isOutgoing: false, text: "Hello Landlord, I'm interested in renting out this space.", time: "7:00 AM" },
      { id: "m2", isOutgoing: true, text: "Hi Sarah! To secure it, I'd need an application filled out.", time: "7:15 AM" }
    ]
  },
  {
    id: "conv-2",
    name: "John Doe",
    avatar: "https://i.pravatar.cc/150?img=12",
    propertyTitle: "Riverside Drive, Austin, TX",
    isUnread: true,
    isArchived: false,
    messages: [
      { id: "m3", isOutgoing: false, text: "Is the pet policy flexible for puppies?", time: "5hr ago" }
    ]
  },
  {
    id: "conv-3",
    name: "Jane Doe",
    avatar: "https://i.pravatar.cc/150?img=32",
    propertyTitle: "Willowbrook Court, Austin, TX",
    isUnread: false,
    isArchived: true,
    messages: [
      { id: "m4", isOutgoing: true, text: "Yes, it's still available for viewing.", time: " Yesterday" }
    ]
  }
];


const MessagingService = {

  async getConversations(tab = 'all', searchQuery = '') {
    return new Promise((resolve) => {
      setTimeout(() => {
        let filtered = mockConversations.filter(c => {
          if (tab === 'unread') return c.isUnread && !c.isArchived;
          if (tab === 'archive') return c.isArchived;
          return !c.isArchived; 
        });

        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.propertyTitle.toLowerCase().includes(q) ||
            c.messages.some(m => m.text.toLowerCase().includes(q))
          );
        }

        const counts = {
          all: mockConversations.filter(c => !c.isArchived).length,
          unread: mockConversations.filter(c => c.isUnread && !c.isArchived).length,
          archive: mockConversations.filter(c => c.isArchived).length
        };

        resolve({ data: filtered, counts });
      }, 300); 
    });
  },

  
  async getThreadMessages(conversationId) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const conv = mockConversations.find(c => c.id === conversationId);
        if (!conv) {
          reject(new Error("Conversation not found"));
          return;
        }
        resolve({
          data: {
            user: { name: conv.name, avatar: conv.avatar, property: conv.propertyTitle },
            messages: conv.messages
          }
        });
      }, 200);
    });
  },

  async sendMessage(conversationId, text) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const conv = mockConversations.find(c => c.id === conversationId);
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const newMessage = {
          id: `m_${Date.now()}`,
          isOutgoing: true,
          text: text,
          time: timeStr
        };

        if (conv) {
          conv.messages.push(newMessage);
        }

        resolve({ data: newMessage });
      }, 200);
    });
  },

  async markAsRead(conversationId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const conv = mockConversations.find(c => c.id === conversationId);
        if (conv) conv.isUnread = false;
        resolve({ success: true });
      }, 100);
    });
  }
};

window.MessagingService = MessagingService;