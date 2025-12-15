import sys
import asyncio
import json
import time
import base64
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()

async def analyze_page(url):
    """Open URL with Playwright and collect comprehensive page information"""
    try:
        print("🐍 Browser: Starting analyze_page function", file=sys.stderr, flush=True)
        print(f"🐍 Browser: Target URL: {url}", file=sys.stderr, flush=True)
        print("🐍 Browser: Initializing Playwright...", file=sys.stderr, flush=True)
        
        async with async_playwright() as p:
            print("🐍 Browser: Playwright initialized ✓", file=sys.stderr, flush=True)
            print("🐍 Browser: Launching Chromium (headless)...", file=sys.stderr, flush=True)
            
            # In cloud environments there is no X server, so we must run headless
            # and disable sandboxing flags that are not available in containers.
            browser = await p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            print("🐍 Browser: Chromium launched ✓", file=sys.stderr, flush=True)
            
            page = await browser.new_page()
            print("🐍 Browser: New page created ✓", file=sys.stderr, flush=True)
            
            print(f"🐍 Browser: Navigating to {url}...", file=sys.stderr, flush=True)
            print(f"🐍 Browser: Timeout set to 30s, waiting for domcontentloaded", file=sys.stderr, flush=True)
            
            # Set a very short page load timeout and don't wait for all resources
            # This is acceptable since we only need HTML structure for checklist generation
            await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            
            print("🐍 Browser: Page loaded (domcontentloaded) ✓", file=sys.stderr, flush=True)
            print("🐍 Browser: Waiting 1s for JS initialization...", file=sys.stderr, flush=True)
            await page.wait_for_timeout(1000)  # Minimal wait for JS to init
            print("🐍 Browser: JS wait complete ✓", file=sys.stderr, flush=True)
            
            # Extract comprehensive page information
            print("🐍 Browser: Starting data extraction...", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting title...", file=sys.stderr, flush=True)
            title = await page.title()
            print(f"🐍 Browser: Title extracted: '{title[:50]}'", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting HTML content...", file=sys.stderr, flush=True)
            html = await page.content()
            print(f"🐍 Browser: HTML extracted ({len(html)} chars)", file=sys.stderr, flush=True)
            
            content = {
                "url": url,
                "title": title,
                "html": html,
            }
            
            print("🐍 Browser: Extracting stylesheets...", file=sys.stderr, flush=True)
            content["stylesheets"] = await page.evaluate("""() => {
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
            }""")
            print(f"🐍 Browser: Stylesheets extracted ({len(content['stylesheets'])} sheets)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting interactive elements...", file=sys.stderr, flush=True)
            content["interactive_elements"] = await page.evaluate("""() => {
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
            }""")
            print(f"🐍 Browser: Interactive elements extracted ({len(content['interactive_elements'])} elements)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting scripts...", file=sys.stderr, flush=True)
            content["scripts"] = await page.evaluate("""() => {
                return Array.from(document.scripts).map(script => ({
                    src: script.src || 'inline',
                    type: script.type,
                    inline: script.src ? null : script.innerHTML.substring(0, 300)
                }));
            }""")
            print(f"🐍 Browser: Scripts extracted ({len(content['scripts'])} scripts)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting meta tags...", file=sys.stderr, flush=True)
            content["meta"] = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('meta')).map(meta => ({
                    name: meta.name,
                    property: meta.property,
                    content: meta.content
                }));
            }""")
            print(f"🐍 Browser: Meta tags extracted ({len(content['meta'])} tags)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting text content...", file=sys.stderr, flush=True)
            content["text_content"] = await page.evaluate("() => document.body.innerText")
            print(f"🐍 Browser: Text content extracted ({len(content['text_content'])} chars)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting links...", file=sys.stderr, flush=True)
            content["links"] = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('a')).map(a => ({
                    text: a.innerText.trim(),
                    href: a.href,
                    target: a.target
                })).filter(link => link.text);
            }""")
            print(f"🐍 Browser: Links extracted ({len(content['links'])} links)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting buttons...", file=sys.stderr, flush=True)
            content["buttons"] = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')).map(btn => ({
                    text: btn.innerText.trim() || btn.value || btn.getAttribute('aria-label') || 'Button',
                    type: btn.type,
                    onclick: btn.getAttribute('onclick')
                })).filter(btn => btn.text);
            }""")
            print(f"🐍 Browser: Buttons extracted ({len(content['buttons'])} buttons)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting images...", file=sys.stderr, flush=True)
            content["images"] = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('img')).map(img => ({
                    alt: img.alt,
                    src: img.src,
                    width: img.width,
                    height: img.height
                }));
            }""")
            print(f"🐍 Browser: Images extracted ({len(content['images'])} images)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting headings...", file=sys.stderr, flush=True)
            content["headings"] = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
                    level: h.tagName,
                    text: h.innerText.trim(),
                    id: h.id
                })).filter(h => h.text);
            }""")
            print(f"🐍 Browser: Headings extracted ({len(content['headings'])} headings)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting forms...", file=sys.stderr, flush=True)
            content["forms"] = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('form')).map(form => ({
                    action: form.action,
                    method: form.method,
                    id: form.id
                }));
            }""")
            print(f"🐍 Browser: Forms extracted ({len(content['forms'])} forms)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting input fields...", file=sys.stderr, flush=True)
            content["inputs"] = await page.evaluate("""() => {
                return Array.from(document.querySelectorAll('input, textarea, select')).map(input => ({
                    type: input.type || input.tagName.toLowerCase(),
                    placeholder: input.placeholder || '',
                    label: input.getAttribute('aria-label') || input.name || '',
                    required: input.required
                }));
            }""")
            print(f"🐍 Browser: Input fields extracted ({len(content['inputs'])} inputs)", file=sys.stderr, flush=True)
            
            print("🐍 Browser: Extracting page structure complete ✓", file=sys.stderr, flush=True)
            print("🐍 Browser: Taking full-page screenshot...", file=sys.stderr, flush=True)
            
            # Take full page screenshot
            screenshot_filename = f"screenshot_{int(time.time())}.png"
            await page.screenshot(path=screenshot_filename, full_page=True)
            content["screenshot"] = screenshot_filename
            try:
                with open(screenshot_filename, "rb") as f:
                    content["screenshot_base64"] = base64.b64encode(f.read()).decode("ascii")
            except Exception:
                content["screenshot_base64"] = None
            
            print("🐍 Browser: Screenshot saved ✓", file=sys.stderr, flush=True)
            print("🐍 Browser: Closing browser...", file=sys.stderr, flush=True)
            await browser.close()
            print("🐍 Browser: Browser closed ✓", file=sys.stderr, flush=True)
            print("🐍 Browser: Formatting results...", file=sys.stderr, flush=True)
            
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
            
            print("🐍 Browser: Returning results to Node.js ✓", file=sys.stderr, flush=True)
            return {"success": True, "data": analysis, "raw": serializable_content}
    except Exception as e:
        print(f"🐍 Browser: ERROR - {str(e)}", file=sys.stderr, flush=True)
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "URL not provided"}))
        sys.exit(1)
    
    url = sys.argv[1]
    result = asyncio.run(analyze_page(url))
    print(json.dumps(result))

