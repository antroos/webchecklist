import sys
import asyncio
import json
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

async def analyze_page(url):
    """Open URL with Playwright and collect page information"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            page = await browser.new_page()
            
            # Load page with longer timeout and less strict wait condition
            await page.goto(url, wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_timeout(3000)  # Wait 3 seconds for content to render
            
            # Extract page information
            content = {
                "url": url,
                "title": await page.title(),
                "text_content": await page.evaluate("() => document.body.innerText"),
                "links": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('a')).map(a => ({
                        text: a.innerText.trim(),
                        href: a.href
                    })).filter(link => link.text);
                }"""),
                "buttons": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')).map(btn => ({
                        text: btn.innerText.trim() || btn.value || btn.getAttribute('aria-label') || 'Button'
                    })).filter(btn => btn.text);
                }"""),
                "images": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('img')).map(img => ({
                        alt: img.alt,
                        src: img.src
                    }));
                }"""),
                "headings": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                        level: h.tagName,
                        text: h.innerText.trim()
                    })).filter(h => h.text);
                }"""),
                "forms": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('form')).length;
                }"""),
                "inputs": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('input, textarea, select')).map(input => ({
                        type: input.type || input.tagName.toLowerCase(),
                        placeholder: input.placeholder || '',
                        label: input.getAttribute('aria-label') || input.name || ''
                    }));
                }""")
            }
            
            await browser.close()
            
            # Format the data into readable text
            analysis = f"""
Analyzed page: {content['title']}
URL: {content['url']}

=== HEADINGS ===
{chr(10).join([f"{h['level']}: {h['text']}" for h in content['headings'][:20]])}

=== BUTTONS ({len(content['buttons'])}) ===
{chr(10).join([f"- {btn['text']}" for btn in content['buttons'][:20]])}

=== LINKS ({len(content['links'])}) ===
{chr(10).join([f"- {link['text']}: {link['href']}" for link in content['links'][:30]])}

=== IMAGES ({len(content['images'])}) ===
{chr(10).join([f"- Alt: {img['alt']}" for img in content['images'][:15]])}

=== FORMS & INPUTS ===
Forms found: {content['forms']}
Input fields: {len(content['inputs'])}
{chr(10).join([f"- {inp['type']}: {inp['label'] or inp['placeholder']}" for inp in content['inputs'][:15]])}

=== PAGE TEXT (first 2000 chars) ===
{content['text_content'][:2000]}
"""
            
            return {"success": True, "data": analysis}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "URL not provided"}))
        sys.exit(1)
    
    url = sys.argv[1]
    result = asyncio.run(analyze_page(url))
    print(json.dumps(result))

