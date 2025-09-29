#!/usr/bin/env python3
"""
LLM analyzer for news significance - Custom DSPy OpenRouter client
"""
import dspy
import logging
import os
import requests
import json
from typing import Dict, Any

logger = logging.getLogger(__name__)

class CustomOpenRouterLM(dspy.LM):
    """Custom OpenRouter LM that bypasses litellm completely"""

    def __init__(self, model: str, api_key: str, temperature: float = 0.3, max_tokens: int = 1000):
        self.model = model.replace("openrouter/", "")
        self.api_key = api_key
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"

        # DSPy compatibility attributes
        self.model_name = model
        self.provider = "openrouter"
        self.kwargs = {}
        self.cache = {}

        logger.info(f"CustomOpenRouterLM initialized with model: {self.model}")

    def __call__(self, prompt, **kwargs):
        """Direct OpenRouter API call without litellm"""
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://wavesens-trading.app",
                "X-Title": "WaveSens News Analyzer"
            }

            # Convert prompt to messages format
            if isinstance(prompt, str):
                messages = [{"role": "user", "content": prompt}]
            else:
                messages = prompt

            data = {
                "model": self.model,
                "messages": messages,
                "temperature": kwargs.get('temperature', self.temperature),
                "max_tokens": kwargs.get('max_tokens', self.max_tokens)
            }

            response = requests.post(
                self.api_url,
                headers=headers,
                json=data,
                timeout=30
            )

            if response.status_code != 200:
                error_msg = f"OpenRouter API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)

            result = response.json()

            if 'choices' not in result or not result['choices']:
                error_msg = f"Invalid API response: {result}"
                logger.error(error_msg)
                raise Exception(error_msg)

            content = result['choices'][0]['message']['content']

            # Return in DSPy expected format
            return [content]

        except Exception as e:
            logger.error(f"CustomOpenRouterLM call failed: {e}")
            raise e

class NewsSignificanceSignature(dspy.Signature):
    """Оценка значимости новости для финансовых рынков"""

    headline = dspy.InputField(desc="Заголовок новости")
    summary = dspy.InputField(desc="Краткое содержание новости (до 500 символов)")

    significance_score = dspy.OutputField(desc="Балл значимости от 0 до 100")
    is_significant = dspy.OutputField(desc="Значимая ли новость (true/false)")
    reasoning = dspy.OutputField(desc="Объяснение почему важно или неважно")

class NewsAnalyzer:
    def __init__(self, openrouter_api_key, model_name, temperature):
        # Используем кастомный OpenRouter client без litellm
        try:
            self.lm = CustomOpenRouterLM(
                model=model_name,
                api_key=openrouter_api_key,
                temperature=temperature,
                max_tokens=1000
            )

            # Устанавливаем кастомную модель для DSPy
            dspy.configure(lm=self.lm)

            logger.info(f"Custom OpenRouter LM configured successfully with model: {model_name}")

        except Exception as e:
            logger.error(f"Custom OpenRouter LM configuration failed: {e}")
            raise e

        self.predictor = dspy.Predict(NewsSignificanceSignature)

    def analyze(self, headline, summary):
        """Анализ значимости новости"""
        try:
            # Обрезаем summary до 500 символов
            truncated_summary = summary[:500] if summary else ""

            # Создаем подробный промпт для лучшего анализа
            analysis_context = f"""
Анализируй эту новость для финансовых трейдеров.

Оценивай по критериям:
- 80-100: критически важно (слияния, решения ФРС, кризисы)
- 60-79: очень важно (отчеты крупных компаний, макроданные)
- 40-59: умеренно важно (отраслевые новости)
- 20-39: мало важно (кадровые изменения)
- 0-19: не важно (советы, мнения)

Значимыми считай новости со score >= 60.
"""

            response = self.predictor(
                headline=headline,
                summary=truncated_summary + "\n\n" + analysis_context
            )

            # Парсим ответ DSPy
            try:
                score = int(response.significance_score)
                score = max(0, min(100, score))  # Ограничиваем 0-100
            except (ValueError, AttributeError):
                logger.warning(f"Invalid score from DSPy: {response.significance_score}")
                score = 0

            try:
                is_significant_str = str(response.is_significant).lower()
                is_significant = is_significant_str in ['true', '1', 'yes', 'да'] or score >= 60
            except AttributeError:
                is_significant = score >= 60

            try:
                reasoning = str(response.reasoning)
            except AttributeError:
                reasoning = "No reasoning provided"

            logger.debug(f"DSPy analysis: score={score}, significant={is_significant}")
            return score, is_significant, reasoning

        except Exception as e:
            logger.error(f"DSPy analysis failed: {e}")
            return 0, False, f"DSPy error: {str(e)}"