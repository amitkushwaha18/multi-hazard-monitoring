const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

// Gemini client initialize karein
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post('/chat', async (req, res) => {
    try {
        const { message, contextData } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        // System prompt context ke sath
        const systemInstruction = `
        You are 'StructAI Assistant', an AI disaster management & structural health monitoring expert.
        Your goal is to help users with real-time hazard alerts (Earthquake, Flood, Cyclone), structural sensor queries (vibration, tilt, crack detection), evacuation routes, and general safety guidance.
        
        Current Live System Data Context:
        ${contextData ? JSON.stringify(contextData) : 'No live context provided.'}

        Keep your responses clear, helpful, accurate, and concise. Respond in a supportive tone.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { role: 'user', parts: [{ text: `${systemInstruction}\n\nUser Query: ${message}` }] }
            ],
        });

        const reply = response.text;
        res.status(200).json({ success: true, reply });

    } catch (error) {
        console.error('Gemini Chat Error:', error);
        res.status(500).json({ success: false, error: 'Failed to process AI chat response.' });
    }
});

module.exports = router;