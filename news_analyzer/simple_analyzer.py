#!/usr/bin/env python3
"""
Simple LLM analyzer without DSPy to avoid proxy issues
"""
import requests
import json
import logging

logger = logging.getLogger(__name__)

class SimpleNewsAnalyzer:
    def __init__(self, openrouter_api_key, model_name, temperature):
        self.api_key = openrouter_api_key
        self.model = model_name
        self.temperature = temperature

    def analyze(self, headline, summary):
        """Анализ значимости новости через OpenRouter напрямую"""
        try:
            truncated_summary = summary[:500] if summary else ""

            prompt = f"""Analyze the financial market significance of this news.

News headline: {headline}
Summary: {truncated_summary}

Provide your analysis in the following JSON format:
{{
    "significance_score": 0-100 (integer),
    "is_significant": true/false,
    "reasoning": "Brief explanation why this is/isn't significant for markets"
}}

Focus on potential market impact, monetary policy implications, and major economic indicators."""

            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "You are a financial news analyst. Respond only with valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": self.temperature,
                    "max_tokens": 200
                }
            )

            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return self._default_response()

            result = response.json()
            content = result['choices'][0]['message']['content']

            # Parse JSON response
            try:
                # Clean up the content - remove markdown if present
                if '```json' in content:
                    content = content.split('```json')[1].split('```')[0]
                elif '```' in content:
                    content = content.split('```')[1].split('```')[0]

                analysis = json.loads(content.strip())

                score = int(analysis.get('significance_score', 50))
                score = max(0, min(100, score))

                is_significant = analysis.get('is_significant', score >= 70)
                reasoning = analysis.get('reasoning', 'No reasoning provided')

                return {
                    'score': score,
                    'is_significant': is_significant,
                    'reasoning': reasoning
                }

            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.error(f"Failed to parse LLM response: {e}, Content: {content}")
                return self._default_response()

        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            return self._default_response()

    def _default_response(self):
        """Возвращает дефолтный ответ при ошибке"""
        return {
            'score': 50,
            'is_significant': False,
            'reasoning': 'Analysis failed - default response'
        }