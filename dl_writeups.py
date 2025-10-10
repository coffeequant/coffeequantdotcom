import os, re, urllib.parse, requests
from bs4 import BeautifulSoup
from collections import deque

BASE = "http://coffee.coffeequant.com"
START = BASE + "/"
TARGET_PREFIX = "/statics/WriteUps/"

seen_pages = set()
queue = deque([START])

def save_file(url, out_root="WriteUps"):
    rel = urllib.parse.urlparse(url).path
    if not rel.startswith(TARGET_PREFIX):
        return
    local_path = os.path.join(out_root, rel[len(TARGET_PREFIX):])
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    r = requests.get(url, timeout=20)
    if r.ok:
        with open(local_path, "wb") as f:
            f.write(r.content)
        print("saved:", local_path)

while queue:
    page = queue.popleft()
    if page in seen_pages:
        continue
    seen_pages.add(page)

    try:
        r = requests.get(page, timeout=20)
    except Exception as e:
        print("skip:", page, e)
        continue
    if r.status_code != 200 or "text/html" not in r.headers.get("Content-Type",""):
        continue

    soup = BeautifulSoup(r.text, "html.parser")
    # find links and assets
    for tag in soup.find_all(["a","link","script","img"]):
        href = tag.get("href") or tag.get("src")
        if not href:
            continue
        url = urllib.parse.urljoin(page, href)

        # stay on your domain
        pu = urllib.parse.urlparse(url)
        if pu.netloc and pu.netloc != urllib.parse.urlparse(BASE).netloc:
            continue

        # enqueue html pages to keep discovering
        if any(url.endswith(ext) for ext in [".html", ".htm", "/"]):
            queue.append(url)

        # save files under WriteUps
        save_file(url)

