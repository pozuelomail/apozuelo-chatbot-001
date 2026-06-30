const { v4: uuidv4 } = require('uuid');

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
      let text = `Entendido, ${session.data.name}. Esto es lo que puedo ofrecerte según lo que me cuentas:\n\n`;

      text += `🤖 Si buscas **implementar IA**, puedo ayudarte a diseñar una estrategia personalizada.\n`;
      options.push({ id: 'ia', label: 'Implementar IA' });

      text += `📈 Si necesitas **escalar tu proyecto**, tengo recursos y mentorías específicas para eso.\n`;
      options.push({ id: 'scale', label: 'Escalar mi proyecto' });

      text += `⚡ Si quieres **automatizar procesos**, puedo mostrarte herramientas y flujos que funcionan.\n\n`;
      options.push({ id: 'automation', label: 'Automatizar procesos' });

      text += `¿Cuál de estas opciones resuena más contigo?`;

      return { response: text, next: 'options', options };
    }

    case 'solution_ia': {
      session.data.choice = message;
      session.state = 'capture_data';
      return {
        response: `¡Genial! La IA puede transformar tu negocio. ¿Te gustaría:\n\n1️⃣ Recibir una guía gratuita sobre cómo empezar con IA.\n2️⃣ Agendar una llamada gratuita para explorar cómo implementarla en tu caso.\n\nEscribe **1** o **2** según prefieras.`,
        next: 'options',
        options: [
          { id: 'guide', label: 'Guía gratuita' },
          { id: 'call', label: 'Llamada gratuita' },
        ],
      };
    }

    case 'solution_scale': {
      session.data.choice = message;
      session.state = 'capture_data';
      return {
        response: `Escalar un proyecto requiere estrategia y foco. ¿Qué prefieres?\n\n1️⃣ Un mini-curso gratuito sobre cómo escalar tu negocio.\n2️⃣ Una sesión personalizada para diseñar tu plan de escalamiento.\n\nEscribe **1** o **2** según prefieras.`,
        next: 'options',
        options: [
          { id: 'course', label: 'Mini-curso gratuito' },
          { id: 'session', label: 'Sesión personalizada' },
        ],
      };
    }

    case 'solution_automation': {
      session.data.choice = message;
      session.state = 'capture_data';
      return {
        response: `Automatizar procesos es clave para ahorrar tiempo y energía. ¿Qué prefieres?\n\n1️⃣ Una lista de herramientas recomendadas para empezar.\n2️⃣ Una llamada para diseñar un flujo de automatización adaptado a tu negocio.\n\nEscribe **1** o **2** según prefieras.`,
        next: 'options',
        options: [
          { id: 'tools', label: 'Lista de herramientas' },
          { id: 'call', label: 'Llamada de diseño' },
        ],
      };
    }

    case 'capture_data': {
      if (!session.data.fullName) {
        session.data.fullName = message;
        return {
          response: `Gracias, ${session.data.name}. ¿Cuál es tu correo electrónico para poder enviarte la información?`,
          next: 'input',
        };
      }

      if (!session.data.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(message)) {
          session.data.email = message;
          return {
            response: `Perfecto. ¿Podrías indicarme también tu número de teléfono para poder contactarte más rápido?`,
            next: 'input',
          };
        }
        return {
          response: `El correo electrónico no parece válido. ¿Puedes escribirlo nuevamente?`,
          next: 'input',
        };
      }

      if (!session.data.phone) {
        session.data.phone = message;
        return {
          response: `Genial. Por último, cuéntame brevemente sobre tu proyecto o negocio para poder prepararme mejor.`,
          next: 'input',
        };
      }

      session.data.description_detail = message;
      session.state = 'farewell';
      return {
        response: `¡Gracias, ${session.data.name}! Con esta información, puedo prepararme mejor para ayudarte. Te contactaré pronto con más detalles.\n\nMientras tanto, ¿hay algo más en lo que pueda asistirte?`,
        next: 'input',
        crmData: {
          full_name: session.data.fullName || session.data.name,
          email: session.data.email,
          phone: session.data.phone,
          notes: `Proyecto: ${session.data.description_detail}\nInterés: ${session.data.category}\nOpción: ${session.data.choice}`,
          status: 'active',
          acquisition_source: 'Chatbot-001',
          company: session.data.name,
        },
      };
    }

    case 'farewell': {
      if (/no|nada|gracias|eso es todo/i.test(message)) {
        session.state = 'feedback';
        return {
          response: `Antes de despedirnos, ¿esta conversación te fue útil? ¿Hay algo que crees que podría mejorar?`,
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
    if (optionId === 'ia') session.state = 'solution_ia';
    else if (optionId === 'scale') session.state = 'solution_scale';
    else if (optionId === 'automation') session.state = 'solution_automation';
    else return { response: 'Por favor, selecciona una de las opciones disponibles.', next: 'options' };
    return handleMessage(session, optionId);
  }

  if (session.state === 'solution_ia' || session.state === 'solution_scale' || session.state === 'solution_automation') {
    session.data.choice = optionId;
    session.state = 'capture_data';
    return {
      response: `Perfecto. Para poder ayudarte mejor, ¿puedes confirmarme tu nombre completo?`,
      next: 'input',
    };
  }

  return handleMessage(session, optionId);
}

module.exports = { handleMessage, handleOption, getSession, createSession };
