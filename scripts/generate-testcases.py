#!/usr/bin/env python3
"""
testcase-ac의 generator + correct 코드를 이용해 각 문제의 testcases.json을 생성합니다.

Usage:
  python3 generate-testcases.py              # 전체 처리
  python3 generate-testcases.py --problem 1003   # 특정 문제만
  python3 generate-testcases.py --count 20       # 문제당 개수 지정
  python3 generate-testcases.py --force          # 기존 파일 덮어쓰기
"""

import argparse
import glob
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional

TESTCASE_AC = Path("/Users/suinkim/dev/krafton/coach/testcase-ac/testcase/boj")
BOJ_PROBLEMS = Path("/Users/suinkim/dev/krafton/coach/boj/problems")
TESTLIB_URL = "https://raw.githubusercontent.com/MikeMirzayanov/testlib/master/testlib.h"
TESTLIB_DIR = Path(tempfile.gettempdir()) / "boj-testlib"
DEFAULT_COUNT = 50

BITS_STDC = """\
#pragma once
#include <algorithm>
#include <array>
#include <bitset>
#include <cassert>
#include <cctype>
#include <climits>
#include <cmath>
#include <complex>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <functional>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <list>
#include <map>
#include <memory>
#include <numeric>
#include <optional>
#include <queue>
#include <random>
#include <set>
#include <sstream>
#include <stack>
#include <string>
#include <tuple>
#include <unordered_map>
#include <unordered_set>
#include <utility>
#include <variant>
#include <vector>
"""


def normalize(s: str) -> str:
    lines = [line.rstrip() for line in s.splitlines()]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines) + "\n" if lines else ""


def download_testlib(dest: Path) -> bool:
    if dest.exists():
        return True
    print("testlib.h 다운로드 중...")
    r = subprocess.run(["curl", "-fsSL", "-o", str(dest), TESTLIB_URL], capture_output=True)
    return r.returncode == 0


def compile_cpp(src: Path, out: Path) -> bool:
    cmd = ["g++", "-O2", "-std=c++23", "-I", str(TESTLIB_DIR), "-o", str(out), str(src)]
    r = subprocess.run(cmd, capture_output=True, timeout=30)
    return r.returncode == 0


def run_bin(bin_path: Path, stdin: str = "", timeout: float = 5.0) -> Optional[str]:
    try:
        r = subprocess.run(
            [str(bin_path)], input=stdin,
            capture_output=True, text=True, timeout=timeout
        )
        return r.stdout if r.returncode == 0 else None
    except subprocess.TimeoutExpired:
        return None


def run_generator(gen_path: Path, seed: int, timeout: float = 5.0) -> Optional[str]:
    try:
        if gen_path.suffix == ".py":
            cmd = ["python3", str(gen_path), str(seed)]
        else:
            cmd = [str(gen_path), str(seed)]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout if r.returncode == 0 else None
    except subprocess.TimeoutExpired:
        return None


def run_singlegen(gen_path: Path, timeout: float = 5.0) -> Optional[str]:
    try:
        if gen_path.suffix == ".py":
            cmd = ["python3", str(gen_path)]
        else:
            cmd = [str(gen_path)]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout if r.returncode == 0 else None
    except subprocess.TimeoutExpired:
        return None


def verify_correct(correct_bin: Path, samples: list[dict]) -> bool:
    for sample in samples:
        actual = run_bin(correct_bin, sample["input"])
        if actual is None:
            return False
        if normalize(actual) != normalize(sample["output"]):
            return False
    return True


def process_problem(problem_id: str, tmpdir: Path, count: int) -> tuple:
    tc_dir = TESTCASE_AC / problem_id
    boj_dir = BOJ_PROBLEMS / problem_id
    problem_json_path = boj_dir / "problem.json"

    if not problem_json_path.exists():
        return None, "boj-archive에 없음"

    correct_files = sorted(glob.glob(str(tc_dir / "correct_*.cpp")))
    generator_files = sorted(glob.glob(str(tc_dir / "generator_*.cpp")) +
                             glob.glob(str(tc_dir / "generator_*.py")))
    singlegen_files = sorted(glob.glob(str(tc_dir / "singlegen_*.py")) +
                             glob.glob(str(tc_dir / "singlegen_*.cpp")))

    if not correct_files:
        return None, "correct 없음"
    if not generator_files and not singlegen_files:
        return None, "generator 없음"

    with open(problem_json_path, encoding="utf-8") as f:
        problem_data = json.load(f)

    if problem_data.get("isSpecialJudge") or problem_data.get("is_special_judge"):
        return None, "스페셜 저지 스킵"

    # correct 컴파일
    correct_src = Path(correct_files[0])
    correct_bin = tmpdir / f"correct_{problem_id}"
    if not compile_cpp(correct_src, correct_bin):
        return None, "correct 컴파일 실패"

    # 샘플로 correct 검증
    samples = problem_data.get("samples", [])
    if samples and not verify_correct(correct_bin, samples):
        return None, "샘플 검증 실패"

    testcases: list[dict] = []

    # generator로 랜덤 케이스 생성
    if generator_files:
        gen_src = Path(generator_files[0])
        if gen_src.suffix == ".cpp":
            gen_bin = tmpdir / f"gen_{problem_id}"
            if not compile_cpp(gen_src, gen_bin):
                return None, "generator 컴파일 실패"
            gen_exec = gen_bin
        else:
            gen_exec = gen_src

        for seed in range(1, count + 1):
            input_data = run_generator(gen_exec, seed)
            if input_data is None:
                continue
            output_data = run_bin(correct_bin, input_data)
            if output_data is None:
                continue
            testcases.append({
                "input": input_data,
                "output": normalize(output_data),
            })

    # singlegen으로 엣지 케이스 추가
    for sg_path in [Path(p) for p in singlegen_files]:
        if sg_path.suffix == ".cpp":
            sg_bin = tmpdir / f"sg_{problem_id}_{sg_path.stem}"
            if not compile_cpp(sg_path, sg_bin):
                continue
            input_data = run_singlegen(sg_bin)
        else:
            input_data = run_singlegen(sg_path)

        if input_data is None:
            continue
        output_data = run_bin(correct_bin, input_data)
        if output_data is None:
            continue
        testcases.append({
            "input": input_data,
            "output": normalize(output_data),
        })

    if not testcases:
        return None, "케이스 생성 실패"

    return testcases, f"{len(testcases)}개 생성"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT, help="문제당 랜덤 케이스 수 (기본값: 50)")
    parser.add_argument("--problem", type=str, help="특정 문제 ID만 처리")
    parser.add_argument("--force", action="store_true", help="기존 testcases.json 덮어쓰기")
    args = parser.parse_args()

    # testlib.h + bits/stdc++.h 준비
    TESTLIB_DIR.mkdir(exist_ok=True)
    (TESTLIB_DIR / "bits").mkdir(exist_ok=True)
    (TESTLIB_DIR / "bits" / "stdc++.h").write_text(BITS_STDC)
    if not download_testlib(TESTLIB_DIR / "testlib.h"):
        print("오류: testlib.h 다운로드 실패", file=sys.stderr)
        sys.exit(1)

    # 처리할 문제 목록
    if args.problem:
        problem_ids = [args.problem]
    else:
        problem_ids = sorted(
            d.name for d in TESTCASE_AC.iterdir() if d.is_dir()
        )

    stats = {"success": 0, "skipped": 0, "failed": 0}
    total = len(problem_ids)

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        for i, problem_id in enumerate(problem_ids, 1):
            if not (TESTCASE_AC / problem_id).is_dir():
                continue

            out_path = BOJ_PROBLEMS / problem_id / "testcases.json"
            if out_path.exists() and not args.force:
                stats["skipped"] += 1
                continue

            prefix = f"[{i}/{total}] BOJ {problem_id}"
            testcases, msg = process_problem(problem_id, tmpdir, args.count)

            if testcases is None:
                print(f"{prefix}: {msg}")
                if "실패" in msg:
                    stats["failed"] += 1
                else:
                    stats["skipped"] += 1
                continue

            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(testcases, f, ensure_ascii=False)

            print(f"{prefix}: {msg}")
            stats["success"] += 1

    print(f"\n완료 — 성공 {stats['success']}개 / 스킵 {stats['skipped']}개 / 실패 {stats['failed']}개")


if __name__ == "__main__":
    main()
