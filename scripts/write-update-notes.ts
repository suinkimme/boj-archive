// Notion API를 직접 호출해 이미지/헤딩/divider 블록을 포함한 업데이트 노트를 작성한다.
// MCP 도구 스키마가 paragraph/bulleted_list_item만 지원하므로 fetch로 우회.

const PAGE_ID = "35783171-7d75-81a6-b450-dedbf921d476";
const TOKEN = process.env.NOTION_TOKEN!;
const R2 = "https://pub-82009f37433342d18ea8b576e7e30476.r2.dev/update-notes";

const API = "https://api.notion.com/v1";
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28",
};

type Block = Record<string, unknown>;

function heading2(text: string): Block {
  return {
    type: "heading_2",
    heading_2: {
      rich_text: [{ type: "text", text: { content: text } }],
      color: "default",
    },
  };
}

function paragraph(text: string, bold = false): Block {
  return {
    type: "paragraph",
    paragraph: {
      rich_text: [
        {
          type: "text",
          text: { content: text },
          annotations: { bold },
        },
      ],
    },
  };
}

function image(url: string, caption?: string): Block {
  return {
    type: "image",
    image: {
      type: "external",
      external: { url },
      ...(caption
        ? {
            caption: [{ type: "text", text: { content: caption } }],
          }
        : {}),
    },
  };
}

function divider(): Block {
  return { type: "divider", divider: {} };
}

function empty(): Block {
  return { type: "paragraph", paragraph: { rich_text: [] } };
}

// 연관성 기준으로 구성한 업데이트 노트 블록 목록
const blocks: Block[] = [
  // 인트로
  paragraph(
    "NEXT JUDGE. 새 버전에서 달라진 것들을 소개합니다."
  ),
  empty(),
  divider(),

  // 1. 문제 탐색
  heading2("문제 탐색"),
  paragraph(
    "33,000개 이상의 BOJ 문제를 한 곳에서 탐색할 수 있습니다. 키워드 검색과 난이도 필터로 원하는 문제를 빠르게 찾아보세요."
  ),
  image(`${R2}/problem-list.png`),
  divider(),

  // 2. 문제 풀기 — 분할 화면 & 에디터
  heading2("문제 풀기 — 분할 화면과 코드 에디터"),
  paragraph(
    "문제 설명과 코드 편집기를 나란히 두고 풀 수 있습니다. 가운데 구분선을 드래그해 너비를 자유롭게 조절할 수 있어요. 에디터는 Python, C/C++, Java, Go, Rust 등 다양한 언어의 문법 강조와 자동 들여쓰기를 지원합니다."
  ),
  image(`${R2}/problem-detail-editor.png`),
  divider(),

  // 3. 브라우저 채점
  heading2("브라우저 채점"),
  paragraph(
    "코드를 작성하면 브라우저에서 바로 채점할 수 있습니다. Python과 C/C++를 지원하며, 별도 설치나 서버 대기 없이 결과를 즉시 확인할 수 있습니다. 채점이 시작되면 버튼이 단계별 진행 상태를 표시해 줍니다."
  ),
  divider(),

  // 4. 제출 기록
  heading2("제출 기록"),
  paragraph(
    "같은 문제를 푼 사람들의 제출 기록을 실시간으로 확인할 수 있습니다. 내가 방금 제출한 결과는 기다리지 않고 목록에 바로 반영됩니다."
  ),
  image(`${R2}/problem-detail-submissions.png`),
  divider(),

  // 5. 로그인 & 백준 연동 & 마이 페이지
  heading2("로그인, 백준 연동, 마이 페이지"),
  paragraph(
    "계정을 만들고 로그인할 수 있습니다. 백준 아이디를 연동하면 지금까지 풀었던 문제 이력을 한 번에 가져올 수 있어요. 연동하지 않아도 채점은 자유롭게 이용할 수 있습니다."
  ),
  paragraph(
    "마이 페이지에서는 내가 풀었던 문제, 틀렸던 문제, 최근 제출 기록을 한 곳에서 볼 수 있습니다."
  ),
  divider(),

  // 6. 공지사항
  heading2("공지사항"),
  paragraph(
    "서비스 소식과 업데이트 내용을 공지사항 페이지에서 확인할 수 있습니다."
  ),
  image(`${R2}/notices.png`),
  divider(),

  // 7. 프로젝트 소개
  heading2("프로젝트 소개"),
  paragraph(
    "NEXT JUDGE.가 어떤 서비스인지 소개 페이지에서 확인해 보세요."
  ),
  image(`${R2}/about.png`),
];

async function appendBlocks(pageId: string, blocks: Block[]) {
  // Notion API는 한 번에 최대 100개 블록 허용
  const chunkSize = 50;
  for (let i = 0; i < blocks.length; i += chunkSize) {
    const chunk = blocks.slice(i, i + chunkSize);
    const res = await fetch(`${API}/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ children: chunk }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Notion API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    console.log(
      `✅ Appended blocks ${i + 1}–${i + chunk.length} (${data.results?.length} created)`
    );
  }
}

appendBlocks(PAGE_ID, blocks)
  .then(() => console.log("\n🎉 Done!"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
