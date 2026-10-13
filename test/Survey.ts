import { expect } from "chai";
import { network } from "hardhat";

type Question = {
  question: string;
  options: string[];
};

describe("Survey init", () => {
  const title = "막무가내 설문조사라면";
  const description =
    "중앙화된 설문조사로서, 모든 데이터는 공개되지 않으며 설문조사를 게시한자만 볼 수 있습니다.";
  const questions: Question[] = [
    {
      question: "누가 내 응답을 관리할때 더 솔직할 수 있을까요?",
      options: [
        "구글폼 운영자",
        "탈중앙화된 블록체인 (관리주체 없으며 모든 데이터 공개)",
        "상관없음",
      ],
    },
  ];

  const getSurveyContractAndEthers = async (survey: {
    title: string;
    description: string;
    targetNumber: number;
    questions: Question[];
  }) => {
    const { ethers } = await network.connect();
    const cSurvey = await ethers.deployContract("Survey", [
      survey.title,
      survey.description,
      survey.targetNumber,
      survey.questions,
    ]);
    return { ethers, cSurvey };
  };

  const getFundedSurvey = async (targetNumber: number, pool: string) => {
    const { ethers } = await network.connect();
    const cSurvey = await ethers.deployContract(
      "Survey",
      [title, description, targetNumber, questions],
      { value: ethers.parseEther(pool) },
    );
    return { ethers, cSurvey };
  };

  describe("Deployment", () => {
    it("should store survey info correctly", async () => {
      const { cSurvey } = await getSurveyContractAndEthers({
        title,
        description,
        targetNumber: 100,
        questions,
      });

      expect(await cSurvey.title()).to.equal(title);
      expect(await cSurvey.description()).to.equal(description);
      expect(await cSurvey.targetNumber()).to.equal(100);
    });

    it("should calculate rewardAmount correctly", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(4, "10");

      expect(await cSurvey.rewardAmount()).to.equal(ethers.parseEther("2.5"));
    });
  });

  describe("Questions and Answers", () => {
    it("should return questions correctly", async () => {
      const { cSurvey } = await getSurveyContractAndEthers({
        title,
        description,
        targetNumber: 100,
        questions,
      });

      const stored = await cSurvey.getQuestions();

      expect(stored.length).to.equal(questions.length);
      expect(stored[0].question).to.equal(questions[0].question);
      expect(stored[0].options).to.deep.equal(questions[0].options);
    });

    it("should allow valid answer submission", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(10, "10");
      const [, respondent] = await ethers.getSigners();

      await cSurvey
        .connect(respondent)
        .submitAnswer({ respondent: respondent.address, answers: [1] });

      const answers = await cSurvey.getAnswers();

      expect(answers.length).to.equal(1);
      expect(answers[0].respondent).to.equal(respondent.address);
      expect(answers[0].answers).to.deep.equal([1]);
    });

    it("should revert if answer length mismatch", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(10, "10");
      const [, respondent] = await ethers.getSigners();

      await expect(
        cSurvey
          .connect(respondent)
          .submitAnswer({ respondent: respondent.address, answers: [1, 2] }),
      ).to.be.revertedWith("Mismatched answers length");

      expect((await cSurvey.getAnswers()).length).to.equal(0);
    });

    it("should revert if target reached", async () => {
      const targetNumber = 2;
      const { ethers, cSurvey } = await getFundedSurvey(targetNumber, "2");
      const [, first, second, third] = await ethers.getSigners();

      await cSurvey
        .connect(first)
        .submitAnswer({ respondent: first.address, answers: [0] });
      await cSurvey
        .connect(second)
        .submitAnswer({ respondent: second.address, answers: [1] });

      await expect(
        cSurvey
          .connect(third)
          .submitAnswer({ respondent: third.address, answers: [2] }),
      ).to.be.revertedWith("This survey has been ended");

      expect((await cSurvey.getAnswers()).length).to.equal(targetNumber);
    });
  });

  describe("Rewards", () => {
    it("should pay correct reward to respondent", async () => {
      const { ethers, cSurvey } = await getFundedSurvey(4, "10");
      const [, respondent] = await ethers.getSigners();
      const reward = ethers.parseEther("2.5");

      await expect(
        cSurvey
          .connect(respondent)
          .submitAnswer({ respondent: respondent.address, answers: [0] }),
      ).to.changeEtherBalances(
        ethers,
        [respondent, cSurvey],
        [reward, -reward],
      );
    });
  });
});
