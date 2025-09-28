#!/usr/bin/env python3
"""
LLM analyzer for news significance
"""
import dspy
import logging

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
        # Настройка OpenRouter через DSPy
        import os
        os.environ['OPENROUTER_API_KEY'] = openrouter_api_key

        # Отключаем proxies в litellm для избежания ошибки
        try:
            import litellm
            litellm.drop_params = True
            litellm.turn_off_message_logging = True
            # Принудительно отключаем все proxy параметры
            import os
            if 'HTTP_PROXY' in os.environ:
                del os.environ['HTTP_PROXY']
            if 'HTTPS_PROXY' in os.environ:
                del os.environ['HTTPS_PROXY']
            if 'http_proxy' in os.environ:
                del os.environ['http_proxy']
            if 'https_proxy' in os.environ:
                del os.environ['https_proxy']
        except:
            pass

        try:
            # Patch httpx client creation to ignore proxies
            import httpx
            original_client_init = httpx.Client.__init__
            def patched_client_init(self, **kwargs):
                # Remove proxy-related kwargs
                kwargs.pop('proxies', None)
                kwargs.pop('proxy', None)
                return original_client_init(self, **kwargs)
            httpx.Client.__init__ = patched_client_init
        except:
            pass

        self.lm = dspy.LM(
            model=f"openrouter/{model_name}",
            api_key=openrouter_api_key,
            api_base="https://openrouter.ai/api/v1",
            temperature=temperature
        )
        dspy.settings.configure(lm=self.lm)

        self.predictor = dspy.Predict(NewsSignificanceSignature)

    def analyze(self, headline, summary):
        """Анализ значимости новости"""
        try:
            # Обрезаем summary до 500 символов
            truncated_summary = summary[:500] if summary else ""

            response = self.predictor(
                headline=headline,
                summary=truncated_summary
            )

            # Парсим ответ
            score = int(response.significance_score)
            score = max(0, min(100, score))  # Ограничиваем 0-100

            is_significant = str(response.is_significant).lower() == 'true'
            reasoning = response.reasoning

            return score, is_significant, reasoning

        except Exception as e:
            logger.error(f"LLM analysis failed: {e}")
            return 0, False, f"LLM timeout: {str(e)}"