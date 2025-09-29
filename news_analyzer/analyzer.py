#!/usr/bin/env python3
"""
LLM analyzer for news significance - DSPy with proper OpenRouter configuration
"""
import dspy
import logging
import os

logger = logging.getLogger(__name__)

class NewsSignificanceSignature(dspy.Signature):
    """Оценка значимости новости для финансовых рынков"""

    headline = dspy.InputField(desc="Заголовок новости")
    summary = dspy.InputField(desc="Краткое содержание новости (до 500 символов)")

    significance_score = dspy.OutputField(desc="Балл значимости от 0 до 100")
    is_significant = dspy.OutputField(desc="Значимая ли новость (true/false)")
    reasoning = dspy.OutputField(desc="Объяснение почему важно или неважно")

class NewsAnalyzer:
    def __init__(self, openrouter_api_key, model_name, temperature):
        # Полная конфигурация litellm для исправления всех ошибок
        try:
            import litellm
            # Все возможные исправления для OpenRouter
            litellm.drop_params = True
            litellm.turn_off_message_logging = True

            # Отключаем все проблемные параметры
            if hasattr(litellm, 'client_kwargs'):
                litellm.client_kwargs = {}

            # Настройки для OpenRouter
            litellm.set_verbose = False

            # Принудительно отключаем proxies в любых вариантах
            import os
            for proxy_var in ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']:
                if proxy_var in os.environ:
                    del os.environ[proxy_var]

            logger.info("litellm configured with all proxies fixes")

        except Exception as e:
            logger.warning(f"litellm configuration warning: {e}")

        # Конфигурация DSPy для OpenRouter с минимальными параметрами
        try:
            # Используем только базовые параметры без проблемных настроек
            self.lm = dspy.LM(
                model=f"openrouter/{model_name}",
                api_key=openrouter_api_key,
                api_base="https://openrouter.ai/api/v1",
                temperature=temperature,
                max_tokens=1000
            )

            # Устанавливаем модель для DSPy
            dspy.configure(lm=self.lm)

            logger.info(f"DSPy configured successfully with model: {model_name}")

        except Exception as e:
            logger.error(f"DSPy configuration failed: {e}")
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