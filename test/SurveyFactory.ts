import { expect } from "chai";
import { network } from "hardhat";

const questions = [
  {
    question: "How often do you use public transport?",
    options: ["Every day", "A few times a week", "Rarely", "Never"],
  },
  {
    question: "Which factor matters most to you?",
    options: ["Price", "Speed", "Comfort"],
  },
];

describe("SurveyFactory Contract", () => {
  let ethers;
  let factory, owner, respondent1, respondent2;

  beforeEach(async () => {
    ({ ethers } = await network.connect());

    [owner, respondent1, respondent2] = await ethers.getSigners();

    factory = await ethers.deployContract("SurveyFactory", [
      ethers.parseEther("50"), // min_pool_amount
      ethers.parseEther("0.1"), // min_reward_amount
    ]);
  });

  it("should deploy with correct minimum amounts", async () => {
    expect(await factory.min_pool_amount()).to.equal(ethers.parseEther("50"));
    expect(await factory.min_reward_amount()).to.equal(
      ethers.parseEther("0.1"),
    );
  });

  it("should create a new survey when valid values are provided", async () => {
    const schema = {
      title: "Public transport survey",
      description: "A short survey about commuting habits",
      targetNumber: 100,
      questions,
    };

    const before = await factory.getSurveys();

    const tx = await factory.createSurvey(schema, {
      value: ethers.parseEther("50"),
    });

    const after = await factory.getSurveys();
    expect(after.length).to.equal(before.length + 1);

    await expect(tx)
      .to.emit(factory, "SurveyCreated")
      .withArgs(after[after.length - 1]);
  });

  it("should revert if pool amount is too small", async () => {
    const schema = {
      title: "Underfunded survey",
      description: "The pool is below min_pool_amount",
      targetNumber: 100,
      questions,
    };

    await expect(
      factory.createSurvey(schema, { value: ethers.parseEther("49") }),
    ).to.be.revertedWith("Insufficient pool amount");

    expect((await factory.getSurveys()).length).to.equal(0);
  });

  it("should revert if reward amount per respondent is too small", async () => {
    const schema = {
      title: "Too many respondents",
      description: "The reward per respondent is below min_reward_amount",
      targetNumber: 501,
      questions,
    };

    await expect(
      factory.createSurvey(schema, { value: ethers.parseEther("50") }),
    ).to.be.revertedWith("Insufficient reward amount");

    expect((await factory.getSurveys()).length).to.equal(0);
  });

  it("should store created surveys and return them from getSurveys", async () => {
    const first = {
      title: "First survey",
      description: "Created first",
      targetNumber: 100,
      questions,
    };
    const second = {
      title: "Second survey",
      description: "Created second",
      targetNumber: 200,
      questions,
    };

    await factory.createSurvey(first, { value: ethers.parseEther("50") });
    await factory.createSurvey(second, { value: ethers.parseEther("60") });

    const surveys = await factory.getSurveys();
    expect(surveys.length).to.equal(2);

    const firstSurvey = await ethers.getContractAt("Survey", surveys[0]);
    const secondSurvey = await ethers.getContractAt("Survey", surveys[1]);

    expect(await firstSurvey.title()).to.equal(first.title);
    expect(await secondSurvey.title()).to.equal(second.title);
    expect(await secondSurvey.targetNumber()).to.equal(second.targetNumber);
    expect(await secondSurvey.rewardAmount()).to.equal(
      ethers.parseEther("60") / BigInt(second.targetNumber),
    );
  });
});
