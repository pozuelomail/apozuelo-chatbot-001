const { v4: uuidv4 } = require('uuid');

const CAL_URL = 'https://cal.com/alberto-pozuelo-mozas-f4vngb';

const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > SESSION_TTL) sessions.delete(id);
  }
}, 60 * 1000);

function createSession() {
  const session = {
    id: uuidv4(),
    state: 'welcome',
    data: { name: '', email: '', phone: '', description: '', category: '', choice: '' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  sessions.set(session.id, session);
  return session;
}

function getSession(id) {
  const s = sessions.get(id);
  if (s) s.updatedAt = Date.now();
  return s;
}

function classifyProblem(text) {
  const lower = text.toLowerCase();
  if (/(ia|inteligencia artificial|ai|llm|machine learning|modelo|lenguaje natural|chatbot|gpt)/i.test(lower)) return 'ia';
  if (/(escalar|crecer|crecimiento|scale|expandir|crecimiento|crecer mi proyecto|startup)/i.test(lower)) return 'scale';
  if (/(automatiza|automatización|automatizar|procesos|repetitivo|workflow|flujo|ahorrar tiempo)/i.test(lower)) return 'automation';
  return 'other';
}

function handleMessage(session, message) {
  session.updatedAt = Date.now();

  switch (session.state) {
    case 'welcome':
      session.state = 'ask_name';
      return {
        response: '¡Hola, hermano/hermana! Soy tu asistente inteligente y estoy aquí para ayudarte a encontrar la mejor solución para ti. Cuéntame, ¿cómo prefieres que te llame?',
        next: 'input',
      };

    case 'ask_name':
      session.data.name = message;
      session.state = 'classify';
      return {
        response: `Perfecto, ${message}. Ahora dime, ¿qué te trae por aquí hoy? Escríbeme brevemente tu problema o necesidad.`,
        next: 'input',
      };

    case 'classify': {
      session.data.description = message;
      const category = classifyProblem(message);
      session.data.category = category;

      const options = [];
      let text = `Entendido, ${session.data.name}. Cuéntame, ¿qué área te interesa más? Todas las opciones incluyen una **asesoría gratuita de 30 minutos** con Alberto:\n\n`;

      text += `🤖 **Implementar IA** — intégrala en tu negocio de forma práctica.\n`;
      options.push({ id: 'ia', label: 'Implementar IA' });

      text += `📈 **Escalar tu proyecto** — lleva tu proyecto al siguiente nivel.\n`;
      options.push({ id: 'scale', label: 'Escalar mi proyecto' });

      text += `⚡ **Automatizar procesos** — libera tiempo y reduce errores.\n`;
      options.push({ id: 'automation', label: 'Automatizar procesos' });

      text += `👤 **Hablar directamente con Alberto**.\n\n`;
      options.push({ id: 'talk_to_alberto', label: 'Hablar con Alberto' });

      text += `¿Cuál te interesa?`;

      return { response: text, next: 'options', options };
    }

    case 'capture_data': {
      if (!session.data.fullName) {
        const nameRegex = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s'-]+$/;
        if (nameRegex.test(message)) {
          session.data.fullName = message;
          return {
            response: `Gracias, ${session.data.name}. ¿Cuál es tu correo electrónico para que Alberto pueda contactarte? (ej. nombre@correo.com)`,
            next: 'input',
          };
        }
        return {
          response: `El nombre solo puede contener letras y espacios. ¿Puedes escribirlo nuevamente? (ej. María García)`,
          next: 'input',
        };
      }

      if (!session.data.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(message)) {
          session.data.email = message;
          return {
            response: `Perfecto. ¿Podrías indicarme también tu número de teléfono para poder contactarte más rápido? (recuerda añadir tu prefijo — ej. +34XXXXXXXXX)`,
            next: 'input',
          };
        }
        return {
          response: `El formato del correo no es correcto. Asegúrate de escribir algo como nombre@correo.com. Intenta de nuevo.`,
          next: 'input',
        };
      }

      if (!session.data.phone) {
        session.data.phone = message;
        const phoneRegex = /^\+?\d{8,15}$/;
        if (phoneRegex.test(message)) {
          return {
            response: `Genial. Por último, cuéntame brevemente sobre tu proyecto o negocio para poder prepararme mejor.`,
            next: 'input',
          };
        }
        session.data.phone = '';
        return {
          response: `El número de teléfono no parece válido — recuerda añadir tu prefijo (ej. +34XXXXXXXXX). Solo números y el símbolo +. Intenta de nuevo.`,
          next: 'input',
        };
      }

      session.data.description_detail = message;

      const crmData = {
        full_name: session.data.fullName || session.data.name,
        email: session.data.email,
        phone: session.data.phone,
        notes: `Proyecto: ${session.data.description_detail}\nInterés: ${session.data.category}\nOpción: ${session.data.choice}`,
        status: 'active',
        acquisition_source: 'Chatbot-001',
        company: session.data.name,
      };

      session.state = 'ended';

      const bookingUrl = `${CAL_URL}?name=${encodeURIComponent(session.data.fullName || session.data.name)}&email=${encodeURIComponent(session.data.email)}`;

      return {
        response: `¡Gracias, ${session.data.name}! Con esta información, puedo prepararme mejor para ayudarte. Alberto se pondrá en contacto contigo pronto.`,
        next: 'end',
        linkButton: { url: bookingUrl, label: 'Reservar asesoría gratuita de 30 min' },
        crmData,
      };
    }

    case 'farewell': {
      if (/no|nada|gracias|eso es todo/i.test(message)) {
        session.state = 'welcome';
        session.data = { name: '', email: '', phone: '', description: '', category: '', choice: '' };
        return {
          response: `¡Entendido! Me alegra haberte sido de ayuda. La conversación se ha reiniciado. ¿En qué puedo ayudarte ahora?`,
          next: 'input',
        };
      }
      return {
        response: `Entendido. Anotado para ayudarte mejor. ¿Algo más en lo que pueda ayudarte?`,
        next: 'input',
      };
    }

    case 'feedback': {
      session.data.feedback = message;
      session.state = 'ended';
      return {
        response: `Hermano, recuerda: el primer paso siempre es el más importante. Estoy aquí para acompañarte en este camino.\n\nSi necesitas algo más, no dudes en escribirme. ¡Nos vemos pronto! 🚀`,
        next: 'end',
      };
    }

    case 'ended':
      return {
        response: `Tu sesión ha finalizado. Si necesitas ayuda nuevamente, recarga la página y con gusto te atenderé. ¡Un abrazo!`,
        next: 'end',
      };

    default:
      session.state = 'welcome';
      return handleMessage(session, message);
  }
}

function handleOption(session, optionId) {
  session.updatedAt = Date.now();

  if (session.state === 'classify') {
    const validOptions = ['ia', 'scale', 'automation', 'talk_to_alberto'];
    if (!validOptions.includes(optionId)) {
      return { response: 'Por favor, selecciona una de las opciones disponibles.', next: 'options' };
    }
    session.data.choice = optionId;
    session.state = 'capture_data';
    return {
      response: `Perfecto. Para agendar tu asesoría gratuita de 30 minutos, necesito algunos datos. ¿Puedes confirmarme tu nombre completo?`,
      next: 'input',
    };
  }

  return handleMessage(session, optionId);
}

module.exports = { handleMessage, handleOption, getSession, createSession };
