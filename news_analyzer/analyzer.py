#!/usr/bin/env python3
"""
LLM analyzer for news significance - Direct OpenRouter API calls
"""
import requests
import json
import logging

logger = logging.getLogger(__name__)

class NewsAnalyzer:
    def __init__(self, openrouter_api_key, model_name, temperature):
        self.api_key = openrouter_api_key
        self.model = model_name
        self.temperature = temperature
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"

        logger.info(f"NewsAnalyzer initialized with model: {model_name}")

    def analyze(self, headline, summary):
        """Анализ значимости новости через прямой API call"""
        try:
            # Обрезаем summary до 500 символов
            truncated_summary = summary[:500] if summary else ""

            prompt = f"""Оцени значимость этой новости для финансовых рынков и трейдеров.

Заголовок: {headline}
Содержание: {truncated_summary}

Ответь СТРОГО в формате JSON:
{{
  "significance_score": <число от 0 до 100>,
  "is_significant": <true или false>,
  "reasoning": "<краткое объяснение>"
}}

Критерии оценки:
- 80-100: критически важно (слияния крупных компаний, решения ФРС, геополитические кризисы)
- 60-79: очень важно (квартальные отчеты крупных компаний, макроэкономические данные)
- 40-59: умеренно важно (отраслевые новости, новые продукты крупных компаний)
- 20-39: мало важно (кадровые перестановки, мелкие события)
- 0-19: не важно (развлекательный контент, советы, мнения)"""

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://wavesens-trading.app",
                "X-Title": "WaveSens News Analyzer"
            }

            data = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": self.temperature,
                "max_tokens": 300
            }

            response = requests.post(
                self.api_url,
                headers=headers,
                json=data,
                timeout=30
            )

            if response.status_code != 200:
                logger.error(f"OpenRouter API error: {response.status_code} - {response.text}")
                return 0, False, f"API error: {response.status_code}"

            result = response.json()

            if 'choices' not in result or not result['choices']:
                logger.error(f"Invalid API response: {result}")
                return 0, False, "Invalid API response"

            content = result['choices'][0]['message']['content'].strip()

            # Парсим JSON из ответа
            try:
                # Ищем JSON в ответе
                start = content.find('{')
                end = content.rfind('}') + 1
                if start >= 0 and end > start:
                    json_str = content[start:end]
                    parsed = json.loads(json_str)

                    score = int(parsed.get('significance_score', 0))
                    score = max(0, min(100, score))  # Ограничиваем 0-100

                    is_significant = bool(parsed.get('is_significant', False))
                    reasoning = str(parsed.get('reasoning', 'No reasoning provided'))

                    return score, is_significant, reasoning
                else:
                    logger.error(f"No JSON found in response: {content}")
                    return 0, False, f"Parse error: no JSON"

            except json.JSONDecodeError as e:
                logger.error(f"JSON parse error: {e}, content: {content}")
                return 0, False, f"JSON parse error: {str(e)}"

        except requests.exceptions.Timeout:
            logger.error("OpenRouter API timeout")
            return 0, False, "API timeout"
        except requests.exceptions.RequestException as e:
            logger.error(f"OpenRouter API request failed: {e}")
            return 0, False, f"Request failed: {str(e)}"
        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            return 0, False, f"Analysis failed: {str(e)}"