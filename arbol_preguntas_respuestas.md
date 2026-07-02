# Árbol de Preguntas y Respuestas — Chatbot Alberto Pozuelo

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| **Bot:** | Mensaje del chatbot |
| → | Transición al siguiente estado |
| `input` | El usuario escribe texto libre |
| `options` | El usuario elige entre botones |
| `end` | Fin del chat (input y opciones ocultos) |

---

## 1. `welcome` — Inicio automático

**Bot:** ¡Hola, hermano/hermana! Soy tu asistente inteligente y estoy aquí para ayudarte a encontrar la mejor solución para ti. Cuéntame, ¿cómo prefieres que te llame?

→ Usuario escribe su nombre (`input`) → `ask_name`

---

## 2. `ask_name`

**Bot:** Perfecto, `{nombre}`. Ahora dime, ¿qué te trae por aquí hoy? Escríbeme brevemente tu problema o necesidad.

→ Usuario escribe su problema (`input`) → `classify`

---

## 3. `classify` — 4 opciones → todas a `capture_data`

**Bot:** Entendido, `{nombre}`. Cuéntame, ¿qué área te interesa más? Todas las opciones incluyen una **asesoría gratuita de 30 minutos** con Alberto:

🤖 **Implementar IA** — intégrala en tu negocio de forma práctica.

📈 **Escalar tu proyecto** — lleva tu proyecto al siguiente nivel.

⚡ **Automatizar procesos** — libera tiempo y reduce errores.

👤 **Hablar directamente con Alberto**.

¿Cuál te interesa?

| Opción | ID del botón | Siguiente estado |
|--------|-------------|-----------------|
| Implementar IA | `ia` | `capture_data` |
| Escalar mi proyecto | `scale` | `capture_data` |
| Automatizar procesos | `automation` | `capture_data` |
| Hablar con Alberto | `talk_to_alberto` | `capture_data` |

---

## 4. `capture_data` — Cuestionario de datos (único camino)

*(Todas las opciones confluyen aquí)*

### Paso 1 — Nombre completo
**Bot:** Perfecto. Para agendar tu asesoría gratuita de 30 minutos, necesito algunos datos. ¿Puedes confirmarme tu nombre completo?

→ Usuario escribe texto (`input`) → se guarda en `session.data.fullName`

### Paso 2 — Correo electrónico
**Bot:** Gracias, `{nombre}`. ¿Cuál es tu correo electrónico para que Alberto pueda contactarte?

→ Usuario escribe email (`input`)

**Validación:** Regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`

- ✅ **Válido** → se guarda y pasa al paso 3
- ❌ **No válido** → **Bot:** El correo electrónico no parece válido. ¿Puedes escribirlo nuevamente? → repite paso 2

### Paso 3 — Teléfono
**Bot:** Perfecto. ¿Podrías indicarme también tu número de teléfono para poder contactarte más rápido? (recuerda añadir tu prefijo)

→ Usuario escribe teléfono (`input`)

**Validación:** Regex `^\+?\d{8,15}$`

- ✅ **Válido** → se guarda y pasa al paso 4
- ❌ **No válido** → **Bot:** El número de teléfono no parece válido — recuerda añadir tu prefijo (ej. +34XXXXXXXXX). Solo números y el símbolo +. Intenta de nuevo. → repite paso 3

### Paso 4 — Descripción del proyecto
**Bot:** Genial. Por último, cuéntame brevemente sobre tu proyecto o negocio para poder prepararme mejor.

→ Usuario escribe texto (`input`) → se guarda en `session.data.description_detail`

→ **Siempre termina en el farewell con botón de Cal.com + fin del chat**

---

## 5. Farewell — Todas las rutas

**Bot:** ¡Gracias, `{nombre}`! Con esta información, puedo prepararme mejor para ayudarte. Alberto se pondrá en contacto contigo pronto.

→ **Botón:** "Reservar asesoría gratuita de 30 min" → abre `https://cal.com/alberto-pozuelo-mozas-f4vngb` en nueva pestaña

→ **Fin del chat** (`end`)
→ Se envían datos a CRM + email + N8N

---

## 6. Estado terminal

| Estado | Mensaje del bot | Comportamiento |
|--------|----------------|---------------|
| `ended` | Tu sesión ha finalizado. Si necesitas ayuda nuevamente, recarga la página y con gusto te atenderé. ¡Un abrazo! | Input y opciones ocultos. Solo se puede reiniciar con botón "Nueva conversación". |

---

## Resumen gráfico del flujo

```
welcome
  │
  └─ ¿Cómo prefieres que te llame?
      │
      └─ ¿Qué problema o necesidad tienes?
          │
          ├── [Implementar IA] ─┐
          ├── [Escalar proyecto] ─┤
          ├── [Automatizar procesos] ─┤
          └── [Hablar con Alberto] ──┘
                    │
                    ▼
          capture_data (nombre → email → teléfono → descripción)
                    │
                    ▼
          "¡Gracias, {nombre}! ..."
          + Botón "Reservar asesoría gratuita de 30 min"
          + FIN
```

## Datos recogidos en `capture_data`

| Campo | Variable | Validación |
|-------|----------|-----------|
| Nombre para llamar | `session.data.name` | ninguna (texto libre) |
| Nombre completo | `session.data.fullName` | ninguna (texto libre) |
| Email | `session.data.email` | regex email |
| Teléfono | `session.data.phone` | regex `^\+?\d{8,15}$` |
| Descripción del proyecto | `session.data.description_detail` | ninguna (texto libre) |
| Categoría detectada | `session.data.category` | `ia` / `scale` / `automation` / `other` |
| Opción elegida | `session.data.choice` | `ia` / `scale` / `automation` / `talk_to_alberto` |

## Integraciones al finalizar

Al llegar al farewell se envía:

1. **CRM** → `POST /api/customers` con los datos del lead
2. **Email** → notificación vía Resend a `NOTIFICATION_EMAIL`
3. **N8N** → webhook con los datos del lead
