import type { RawComment } from "@/features/comments/server/comment-serialization";
import type { AppLocale } from "@/i18n/config";

type Text = readonly [string, string];
type Target = {
  targetType: string;
  targetId?: string;
  sectionId?: string;
  teacherId?: string;
  homeworkId?: string;
  youngId?: string;
};
export type DemoCommunityRecord = {
  target: Target;
  comment: RawComment & { deletedAt?: Date | null };
};

export const DEMO_COMMUNITY_ROOT = "demo-comment-course-01";
const course: Target = { targetType: "course", targetId: "201" };
const authors = [
  {
    id: "demo-community-xia",
    username: "sample-xia",
    name: ["样例同学·小夏", "Sample student Xia"],
  },
  {
    id: "demo-community-qiu",
    username: "sample-qiu",
    name: ["样例同学·小秋", "Sample student Qiu"],
  },
] as const;

function discussionAuthor(person: (typeof authors)[number], locale: AppLocale) {
  return {
    id: person.id,
    username: person.username,
    name: person.name[locale === "zh-cn" ? 0 : 1],
    image: "/images/icon.png",
    isAdmin: false,
    accounts: [],
  };
}

export function getDemoDiscussionAuthors(locale: AppLocale) {
  return authors.map((person) => discussionAuthor(person, locale));
}

export function getDemoDiscussionAuthor(identifier: string, locale: AppLocale) {
  const normalized = identifier.trim();
  const people = getDemoDiscussionAuthors(locale);
  return (
    people.find((person) => person.username === normalized.toLowerCase()) ??
    people.find((person) => person.id === normalized) ??
    null
  );
}

const topics: readonly Text[] = [
  [
    "复习向量空间时，我先检查零向量与加法封闭性，再判断数乘封闭性。",
    "When reviewing vector spaces, I check the zero vector and closure under addition before scalar multiplication.",
  ],
  [
    "整理线性相关的例子时，记得把零向量也作为一个反例。",
    "Include the zero vector when collecting examples of linear dependence.",
  ],
  [
    "求一组基后，可以用矩阵的秩检查向量数量是否正确。",
    "After finding a basis, use the matrix rank to check the number of vectors.",
  ],
  [
    "做消元练习时，我把每一步初等行变换写在矩阵右边，方便复查。",
    "I record each elementary row operation beside the matrix so elimination steps are easy to review.",
  ],
  [
    "行列式计算中，交换两行会改变符号；这个检查能发现不少笔误。",
    "Swapping two rows changes the determinant sign, which is a useful check for transcription mistakes.",
  ],
  [
    "判断矩阵可逆前，先看它是否为方阵，再检查秩或行列式。",
    "Before testing invertibility, check that the matrix is square, then inspect its rank or determinant.",
  ],
  [
    "齐次方程组的解空间可以先从自由变量入手，再写出基础解系。",
    "For a homogeneous system, start with the free variables and then write a basis for the solution space.",
  ],
  [
    "非齐次方程组有解时，通解可以写成一个特解加上齐次解。",
    "A consistent nonhomogeneous system has a general solution consisting of a particular solution plus a homogeneous solution.",
  ],
  [
    "讨论线性映射时，我会同时画出定义域和陪域，避免混淆维数。",
    "I draw both the domain and codomain when discussing linear maps to keep their dimensions distinct.",
  ],
  [
    "计算核与像以后，维数公式是很好的交叉检查。",
    "The rank-nullity formula is a useful cross-check after computing the kernel and image.",
  ],
  [
    "换基矩阵的列向量属于哪一组坐标，需要在计算前明确写出。",
    "State which coordinates form the columns of a change-of-basis matrix before calculating.",
  ],
  [
    "特征向量必须非零。求解特征空间后不要把零向量当作特征向量。",
    "Eigenvectors must be nonzero. Do not list the zero vector as an eigenvector after solving for an eigenspace.",
  ],
  [
    "重复特征值不一定意味着无法对角化，还需要检查特征空间维数。",
    "A repeated eigenvalue does not by itself prevent diagonalization; check the eigenspace dimension.",
  ],
  [
    "内积空间的练习中，正交与单位长度是两个独立条件。",
    "Orthogonality and unit length are separate conditions in inner-product exercises.",
  ],
  [
    "使用施密特正交化时，我先计算投影，再在最后一步单位化。",
    "During Gram-Schmidt orthogonalization, I calculate projections first and normalize at the end.",
  ],
  [
    "最小二乘问题可以通过残差与列空间正交来检查结果。",
    "Check a least-squares result by verifying that the residual is orthogonal to the column space.",
  ],
  [
    "二次型配方法完成后，可以展开结果核对交叉项的系数。",
    "After completing squares in a quadratic form, expand the result to check the cross-term coefficients.",
  ],
  [
    "复习时把定理的条件和结论分开记录，能避免把充分条件当作必要条件。",
    "Keep theorem assumptions separate from conclusions to avoid confusing sufficient and necessary conditions.",
  ],
  [
    "小组讨论可以各自先完成一个小例子，再比较不同解法。",
    "For group study, solve a small example individually before comparing different approaches.",
  ],
  [
    "课程笔记里保留一页常见错误清单，下一次作业前再逐项检查。",
    "Keep a page of common mistakes in your notes and review it before the next assignment.",
  ],
];
const replies: readonly Text[] = [
  [
    "我先检查两个向量是否张成整个平面，再检查它们是否独立。",
    "I first check whether the vectors span the plane, then whether they are independent.",
  ],
  [
    "只检查向量数量还不够，需要实际验证线性无关。",
    "Counting vectors is not enough; linear independence must be checked.",
  ],
  [
    "同意，两个方向相同的非零向量仍然不能组成平面的基。",
    "Agreed: two nonzero vectors pointing in the same direction still do not form a basis of the plane.",
  ],
  [
    "我用一个二阶单位矩阵作为最简单的检查例子。",
    "I use the two-dimensional identity matrix as the simplest check.",
  ],
  [
    "把向量写成列之后，可以用行消元来判断秩。",
    "After writing the vectors as columns, row reduction can determine the rank.",
  ],
  [
    "如果只剩一个主元，就需要回头检查两个向量是否相关。",
    "If only one pivot remains, check whether the vectors are dependent.",
  ],
  [
    "在三维空间里也可以用同样的方法，只是需要检查三个方向。",
    "The same method works in three dimensions, with three directions to check.",
  ],
  [
    "我把标准基与换基后的坐标并排记录，比较清楚。",
    "I put standard-basis and changed-basis coordinates side by side in my notes.",
  ],
  [
    "计算完成后，把坐标代回原向量也能检查结果。",
    "Substituting the coordinates back into the original vector is another useful check.",
  ],
  [
    "这也说明坐标依赖选定的基，而向量本身并没有变化。",
    "This also shows that coordinates depend on the chosen basis while the vector itself stays unchanged.",
  ],
  [
    "谢谢大家，我会把独立性、张成性和代回检查整理成复习清单。",
    "Thanks everyone. I will turn independence, spanning and substitution checks into a revision checklist.",
  ],
];

/** New objects on every read; these named people and records are never database users. */
export function getDemoCommunityRecords(
  locale: AppLocale,
): DemoCommunityRecord[] {
  const text = (value: Text) => value[locale === "zh-cn" ? 0 : 1];
  function record(
    id: string,
    target: Target,
    body: Text,
    author: number,
    at: string,
    parentId: string | null = null,
    rootId: string | null = null,
  ): DemoCommunityRecord {
    const person = author === 0 ? authors[0] : authors[1];
    return {
      target: { ...target },
      comment: {
        id,
        body: text(body),
        status: "active",
        visibility: "public",
        isAnonymous: false,
        userId: person.id,
        user: discussionAuthor(person, locale),
        createdAt: new Date(at),
        updatedAt: new Date(at),
        parentId,
        rootId,
        attachments: [],
        reactionSummaries: [
          { type: "upvote", count: 3, viewerHasReacted: false },
        ],
      },
    };
  }
  const main = record(
    DEMO_COMMUNITY_ROOT,
    course,
    [
      "## 怎样检查一组基？\n\n先分别验证**线性无关**与**张成空间**。例如 $e_1=(1,0)$、$e_2=(0,1)$。\n\n| 检查 | 方法 |\n| --- | --- |\n| 独立性 | 解齐次方程 |\n| 张成性 | 检查矩阵的秩 |",
      "## How can we check a basis?\n\nCheck **linear independence** and **spanning** separately. For example, $e_1=(1,0)$ and $e_2=(0,1)$.\n\n| Check | Method |\n| --- | --- |\n| Independence | Solve a homogeneous system |\n| Spanning | Check the matrix rank |",
    ],
    0,
    "2026-09-20T08:00:00+08:00",
  );
  main.comment.updatedAt = new Date("2026-09-20T09:00:00+08:00");
  const roots = topics.map((body, index) =>
    record(
      `demo-comment-course-${String(index + 2).padStart(2, "0")}`,
      course,
      body,
      index % 2,
      new Date(
        Date.parse("2026-09-21T08:00:00+08:00") +
          Math.floor(index / 2) * 60_000,
      ).toISOString(),
    ),
  );
  const children = replies.map((body, index) =>
    record(
      `demo-comment-course-reply-${String(index + 1).padStart(2, "0")}`,
      course,
      body,
      (index + 1) % 2,
      new Date(
        Date.parse("2026-09-22T08:00:00+08:00") + index * 60_000,
      ).toISOString(),
      index === 2 ? "demo-comment-course-reply-02" : DEMO_COMMUNITY_ROOT,
      DEMO_COMMUNITY_ROOT,
    ),
  );
  const extra = [
    record(
      "demo-comment-section-101",
      { targetType: "section", targetId: "101" },
      [
        "这份教学班样例把课程、教师与课堂日期放在同一处，复习前可以交叉检查。",
        "This sample section brings the course, teachers and class dates together for revision checks.",
      ],
      0,
      "2026-09-23T08:00:00+08:00",
    ),
    record(
      "demo-comment-teacher-401",
      { targetType: "teacher", teacherId: "401" },
      [
        "讨论前我会先整理具体问题，并说明自己已经尝试过哪些步骤。",
        "Before a discussion, I prepare a specific question and explain which steps I have already tried.",
      ],
      1,
      "2026-09-23T09:00:00+08:00",
    ),
    record(
      "demo-comment-section-teacher-101-401",
      { targetType: "section-teacher", sectionId: "101", teacherId: "401" },
      [
        "这条讨论属于本教学班与陈老师的授课关系，不会混入其他教学班。",
        "This discussion belongs to Teacher Chen's assignment to this section, not another section.",
      ],
      0,
      "2026-09-23T10:00:00+08:00",
    ),
    record(
      "demo-comment-homework-vectors",
      { targetType: "homework", homeworkId: "demo-homework-vectors" },
      [
        "向量空间练习的解答里，请写出验证封闭性的推导步骤，而不只给出结论。",
        "For the vector-spaces exercises, include the closure argument rather than only the conclusion.",
      ],
      1,
      "2026-09-23T11:00:00+08:00",
    ),
  ];
  // Deliberately not pre-sorted: readers own chronological ordering and tied IDs.
  return [...extra, ...children.toReversed(), ...roots.toReversed(), main];
}
