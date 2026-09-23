import { expect } from "chai";
import { network } from "hardhat";

const questions = [
  {
    question: "How do you usually get to work?",
    options: ["Bus", "Subway", "Car", "Walk"],
  },
  {
    question: "How long is your commute?",
    options: ["Under 30 minutes", "30 to 60 minutes", "Over an hour"],
  },
];

describe("Survey Contract", () => {
  let ethers;
  let survey, owner, respondent1, respondent2;
  let poolAmount;

  const targetNumber = 10;

  beforeEach(async () => {
    ({ ethers } = await network.connect());
    poolAmount = ethers.parseEther("5");

    [owner, respondent1, respondent2] = await ethers.getSigners();

    survey = await ethers.deployContract(
      "Survey",
      ["Commute survey", "A survey about commuting", questions, targetNumber],
      { value: poolAmount },
    );
  });

  it("should store the values given to the constructor", async () => {
    expect(await survey.title()).to.equal("Commute survey");
    expect(await survey.description()).to.equal("A survey about commuting");
    expect(await survey.targetNumber()).to.equal(targetNumber);
    expect(await survey.rewardAmount()).to.equal(
      poolAmount / BigInt(targetNumber),
    );
  });

  it("should return the questions registered at deployment", async () => {
    const stored = await survey.getQuestions();

    expect(stored.length).to.equal(questions.length);
    expect(stored[0].question).to.equal(questions[0].question);
    expect(stored[0].options).to.deep.equal(questions[0].options);
    expect(stored[1].options).to.deep.equal(questions[1].options);
  });

  it("should keep the submitted answer and pay the reward", async () => {
    const reward = await survey.rewardAmount();

    const tx = await survey
      .connect(respondent1)
      .submitAnswer({ respondent: respondent1.address, answers: [0, 1] });

    await expect(tx).to.changeEtherBalance(ethers, survey, -reward);

    const answers = await survey.getAnswers();
    expect(answers.length).to.equal(1);
    expect(answers[0].respondent).to.equal(respondent1.address);
    expect(answers[0].answers).to.deep.equal([0, 1]);
  });

  it("should collect answers from several respondents", async () => {
    await survey
      .connect(respondent1)
      .submitAnswer({ respondent: respondent1.address, answers: [0, 1] });
    await survey
      .connect(respondent2)
      .submitAnswer({ respondent: respondent2.address, answers: [3, 2] });

    const answers = await survey.getAnswers();

    expect(answers.length).to.equal(2);
    expect(answers[1].respondent).to.equal(respondent2.address);
    expect(answers[1].answers).to.deep.equal([3, 2]);
  });

  it("should revert if the answer count does not match the questions", async () => {
    await expect(
      survey
        .connect(respondent1)
        .submitAnswer({ respondent: respondent1.address, answers: [0] }),
    ).to.be.revertedWith("Mismatched answers length");

    expect((await survey.getAnswers()).length).to.equal(0);
  });
});
