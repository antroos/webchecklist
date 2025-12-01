import os
from flask import Flask, request, jsonify
from browser_use import Agent
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

SYSTEM_PROMPT = """Создай структурированный чек-лист тестирования страницы сайта. 

Формат должен точно соответствовать этому шаблону:

Колонки:
- Check
- Opera GX
- Chrome
- Android Chrome
- Android Browser
- iOS Chrome
- iOS Safari
- MacOS Chrome
- MacOS Safari
- Comment

Для каждой проверки используй уровень детализации, как в примерах ниже:

Примеры формулировок:
- "Текст в блоке <название> отображается корректно, без переносов и ошибок."
- "Кнопка <название> редиректит на правильную страницу."
- "Изображение <название> отображается без артефактов."
- "Сетка блоков не ломается в адаптиве."
- "Меню корректно открывается и закрывается."
- "Все ссылки внутри блока работают."

Обязательно включи следующие категории проверок:
1. Тексты
2. Изображения
3. Блоки и секции
4. Ссылки и переходы
5. Кнопки и CTA
6. Стили и верстка
7. Мобильная адаптивность
8. Сеточные элементы
9. Header и Footer (если присутствуют на странице)
10. Кросс-браузерность — одна строка на каждый элемент

Не включай backend функциональность, если её нет на странице.

Сгенерируй 40–80 пунктов, в зависимости от сложности страницы."""


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})


@app.route('/analyze', methods=['POST'])
async def analyze():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({'error': 'URL is required'}), 400
    
    try:
        # Initialize the LLM
        llm = ChatOpenAI(model="gpt-4o")
        
        # Create browser agent
        agent = Agent(
            task=f"Open {url} and analyze the page content, structure, images, buttons, links, and layout",
            llm=llm
        )
        
        # Run the agent to browse the page
        result = await agent.run()
        
        # Now send the analyzed content to OpenAI with our system prompt
        from openai import OpenAI
        client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"На основе анализа страницы {url}, создай чек-лист. Вот что я увидел на странице:\n\n{result}"}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        checklist = response.choices[0].message.content
        
        return jsonify({
            'url': url,
            'checklist': checklist
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

