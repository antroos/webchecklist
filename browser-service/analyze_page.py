import sys
import asyncio
import json
import time
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

async def analyze_page(url):
    """Open URL with Playwright and collect comprehensive page information"""
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=False)
            page = await browser.new_page()
            
            # Load page with longer timeout
            await page.goto(url, wait_until='domcontentloaded', timeout=60000)
            await page.wait_for_timeout(3000)  # Wait for content to render
            
            # Extract comprehensive page information
            content = {
                "url": url,
                "title": await page.title(),
                
                # Full HTML structure
                "html": await page.content(),
                
                # All CSS stylesheets
                "stylesheets": await page.evaluate("""() => {
                    return Array.from(document.styleSheets).map(sheet => {
                        try {
                            return {
                                href: sheet.href || 'inline',
                                rules: Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\\n')
                            };
                        } catch (e) {
                            return { href: sheet.href || 'inline', rules: 'CORS blocked or no access' };
                        }
                    });
                }"""),
                
                # Interactive elements with event handlers
                "interactive_elements": await page.evaluate("""() => {
                    const elements = [];
                    document.querySelectorAll('[onclick], [onmouseover], [onsubmit], [onchange]').forEach(el => {
                        elements.push({
                            tag: el.tagName,
                            onclick: el.getAttribute('onclick'),
                            onmouseover: el.getAttribute('onmouseover'),
                            text: el.innerText?.substring(0, 50)
                        });
                    });
                    return elements;
                }"""),
                
                # All scripts
                "scripts": await page.evaluate("""() => {
                    return Array.from(document.scripts).map(script => ({
                        src: script.src || 'inline',
                        type: script.type,
                        inline: script.src ? null : script.innerHTML.substring(0, 300)
                    }));
                }"""),
                
                # Meta tags
                "meta": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('meta')).map(meta => ({
                        name: meta.name,
                        property: meta.property,
                        content: meta.content
                    }));
                }"""),
                
                # Text content
                "text_content": await page.evaluate("() => document.body.innerText"),
                
                # Links
                "links": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('a')).map(a => ({
                        text: a.innerText.trim(),
                        href: a.href,
                        target: a.target
                    })).filter(link => link.text);
                }"""),
                
                # Buttons
                "buttons": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')).map(btn => ({
                        text: btn.innerText.trim() || btn.value || btn.getAttribute('aria-label') || 'Button',
                        type: btn.type,
                        onclick: btn.getAttribute('onclick')
                    })).filter(btn => btn.text);
                }"""),
                
                # Images
                "images": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('img')).map(img => ({
                        alt: img.alt,
                        src: img.src,
                        width: img.width,
                        height: img.height
                    }));
                }"""),
                
                # Headings
                "headings": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                        level: h.tagName,
                        text: h.innerText.trim(),
                        id: h.id
                    })).filter(h => h.text);
                }"""),
                
                # Forms
                "forms": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('form')).map(form => ({
                        action: form.action,
                        method: form.method,
                        id: form.id
                    }));
                }"""),
                
                # Input fields
                "inputs": await page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('input, textarea, select')).map(input => ({
                        type: input.type || input.tagName.toLowerCase(),
                        placeholder: input.placeholder || '',
                        label: input.getAttribute('aria-label') || input.name || '',
                        required: input.required
                    }));
                }""")
            }
            
            # Take full page screenshot
            screenshot_filename = f"screenshot_{int(time.time())}.png"
            await page.screenshot(path=screenshot_filename, full_page=True)
            content["screenshot"] = screenshot_filename
            
            await browser.close()
            
            # Format comprehensive analysis
            analysis = f"""
Analyzed page: {content['title']}
URL: {content['url']}

=== HTML STRUCTURE ===
HTML length: {len(content['html'])} characters
Screenshot saved: {content['screenshot']}

=== STYLESHEETS ({len(content['stylesheets'])}) ===
{chr(10).join([f"- {sheet['href']}: {len(sheet['rules'])} chars" for sheet in content['stylesheets'][:10]])}

=== JAVASCRIPT ({len(content['scripts'])}) ===
{chr(10).join([f"- {script['src']}" for script in content['scripts'][:10]])}

=== META TAGS ({len(content['meta'])}) ===
{chr(10).join([f"- {m.get('name') or m.get('property')}: {m['content'][:50]}" for m in content['meta'][:10] if m.get('content')])}

=== HEADINGS ({len(content['headings'])}) ===
{chr(10).join([f"{h['level']}: {h['text']}" for h in content['headings'][:20]])}

=== BUTTONS ({len(content['buttons'])}) ===
{chr(10).join([f"- {btn['text']} (onclick: {btn['onclick'] or 'none'})" for btn in content['buttons'][:20]])}

=== INTERACTIVE ELEMENTS ({len(content['interactive_elements'])}) ===
{chr(10).join([f"- {el['tag']}: {el['text']}" for el in content['interactive_elements'][:15]])}

=== LINKS ({len(content['links'])}) ===
{chr(10).join([f"- {link['text']}: {link['href']}" for link in content['links'][:30]])}

=== IMAGES ({len(content['images'])}) ===
{chr(10).join([f"- {img['src']}: {img['alt']}" for img in content['images'][:15]])}

=== FORMS ({len(content['forms'])}) ===
{chr(10).join([f"- Action: {form['action']}, Method: {form['method']}" for form in content['forms']])}

=== INPUT FIELDS ({len(content['inputs'])}) ===
{chr(10).join([f"- {inp['type']}: {inp['label'] or inp['placeholder']} (required: {inp['required']})" for inp in content['inputs'][:15]])}

=== FULL HTML (first 3000 chars) ===
{content['html'][:3000]}

=== PAGE TEXT (first 2000 chars) ===
{content['text_content'][:2000]}
"""
            
            # Return serializable data only (exclude non-JSON-safe objects)
            serializable_content = {
                "url": content["url"],
                "title": content["title"],
                "html": content["html"],
                "stylesheets": content["stylesheets"],
                "interactive_elements": content["interactive_elements"],
                "scripts": content["scripts"],
                "meta": content["meta"],
                "text_content": content["text_content"],
                "links": content["links"],
                "buttons": content["buttons"],
                "images": content["images"],
                "headings": content["headings"],
                "forms": content["forms"],
                "inputs": content["inputs"],
                "screenshot": content["screenshot"]
            }
            
            return {"success": True, "data": analysis, "raw": serializable_content}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "URL not provided"}))
        sys.exit(1)
    
    url = sys.argv[1]
    result = asyncio.run(analyze_page(url))
    print(json.dumps(result))

