"""
다중 언어 전환 데모 GIF 생성 스크립트

흐름: 문제 1000 열기 → C++ 코드 작성 & 실행(pass) → Python으로 전환 & 실행(pass)
"""

import subprocess
import time
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = 'http://localhost:8080/'
USERDATA = Path(__file__).parent / '.playwright-userdata'
VIDEOS_DIR = Path(__file__).parent / '.playwright-videos-ml'
GIF_OUT = Path(__file__).parent / 'demo_multilang.gif'

CPP_CODE = '#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b;\n    return 0;\n}'
PY_CODE  = 'a, b = map(int, input().split())\nprint(a + b)'


def type_code(editor, code, delay=0.028):
    editor.click()
    editor.fill('')
    time.sleep(0.1)
    for line in code.split('\n'):
        for ch in line:
            editor.type(ch)
            time.sleep(delay)
        editor.type('\n')
        time.sleep(0.06)


def prewarm():
    """Pyodide + JSCPP 모두 SW 캐시에 적재."""
    print('🔥 프리웜 중 (Pyodide + JSCPP)...')
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(USERDATA), headless=True,
            viewport={'width': 1100, 'height': 750},
        )
        page = ctx.new_page()
        page.goto(URL)
        page.wait_for_selector('.problem-row', timeout=15000)
        page.click('.problem-row[data-id="1000"]')
        page.wait_for_selector('#py-code', timeout=5000)

        # ── C++ 프리웜 ──────────────────────────────────────
        page.select_option('#runner-lang', 'cpp')
        page.fill('#py-code', '#include<cstdio>\nint main(){printf("3");return 0;}')
        page.click('#py-run-all-btn')
        print('  JSCPP 로딩 중 (최대 60초)...')
        page.wait_for_selector('.py-chip-case.pass, .py-chip-case.fail', timeout=60000)
        print('  ✅ JSCPP 캐시 완료')

        # ── Python 프리웜 ────────────────────────────────────
        page.select_option('#runner-lang', 'python')
        page.fill('#py-code', 'print(3)')
        page.click('#py-run-all-btn')
        print('  Pyodide 로딩 중 (최대 90초)...')
        page.wait_for_selector('.py-chip-case.pass, .py-chip-case.fail', timeout=90000)
        print('  ✅ Pyodide 캐시 완료')

        ctx.close()


def record():
    print('🎬 녹화 시작...')
    VIDEOS_DIR.mkdir(exist_ok=True)

    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            str(USERDATA), headless=False,
            viewport={'width': 1100, 'height': 750},
            record_video_dir=str(VIDEOS_DIR),
            record_video_size={'width': 1100, 'height': 750},
        )
        page = ctx.new_page()
        page.goto(URL)
        page.wait_for_selector('.problem-row', timeout=10000)
        time.sleep(0.8)

        # 검색
        page.fill('#search', '1000')
        time.sleep(0.7)

        # 문제 열기
        page.click('.problem-row[data-id="1000"]')
        page.wait_for_selector('#py-code', timeout=5000)
        time.sleep(0.6)

        # 실행기로 스크롤
        page.evaluate("document.getElementById('py-runner').scrollIntoView({behavior:'smooth',block:'center'})")
        time.sleep(1.0)

        # ── C++ 선택 ─────────────────────────────────────────
        page.select_option('#runner-lang', 'cpp')
        time.sleep(0.5)

        # C++ 코드 타이핑
        editor = page.locator('#py-code')
        type_code(editor, CPP_CODE, delay=0.025)
        time.sleep(0.6)

        # 실행
        page.click('#py-run-all-btn')
        page.wait_for_selector('.py-chip-case.pass, .py-chip-case.fail, .py-chip-case.error', timeout=30000)
        time.sleep(0.8)

        # 결과 펼치기 (pass/fail 무관)
        chip = page.locator('.py-chip-case').first
        chip.click()
        time.sleep(1.8)

        # ── Python으로 전환 ───────────────────────────────────
        page.select_option('#runner-lang', 'python')
        time.sleep(0.6)

        # Python 코드 타이핑
        type_code(editor, PY_CODE, delay=0.035)
        time.sleep(0.6)

        # 실행
        page.click('#py-run-all-btn')
        page.wait_for_selector('.py-chip-case.pass, .py-chip-case.fail, .py-chip-case.error', timeout=30000)
        time.sleep(0.8)

        # 결과 펼치기
        chip = page.locator('.py-chip-case').first
        chip.click()
        time.sleep(2.0)

        video_path = page.video.path()
        ctx.close()

    time.sleep(1)
    print(f'  비디오 저장: {video_path}')
    return Path(video_path)


def to_gif(video: Path):
    print('🎨 GIF 변환 중...')
    palette = video.parent / 'palette.png'
    subprocess.run([
        'ffmpeg', '-y', '-i', str(video),
        '-vf', 'fps=12,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff',
        str(palette)
    ], check=True, capture_output=True)
    subprocess.run([
        'ffmpeg', '-y', '-i', str(video), '-i', str(palette),
        '-lavfi', 'fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer',
        str(GIF_OUT)
    ], check=True, capture_output=True)
    palette.unlink(missing_ok=True)
    size_mb = GIF_OUT.stat().st_size / 1024 / 1024
    print(f'  ✅ GIF 저장: {GIF_OUT} ({size_mb:.1f} MB)')


if __name__ == '__main__':
    prewarm()
    video = record()
    to_gif(video)
    shutil.rmtree(VIDEOS_DIR, ignore_errors=True)
    print('🏁 완료! →', GIF_OUT)
