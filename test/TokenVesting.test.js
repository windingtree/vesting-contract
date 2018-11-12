import { latestTime } from 'openzeppelin-solidity/test/helpers/latestTime';
import { increaseTimeTo, duration } from 'openzeppelin-solidity/test/helpers/increaseTime';
import { ether } from 'openzeppelin-solidity/test/helpers/ether';
import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert';
import { log, isFunction } from 'util';
const TokenVesting = artifacts.require('TokenVesting');
const TokenMock = artifacts.require('TokenMock');

const BigNumber = web3.BigNumber;
const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

contract('TokenVesting', function (accounts) {
  const data = {};

  beforeEach(async function () {
    data.token = await TokenMock.new();
    data.start = (await latestTime());
    data.tokenVesting = await TokenVesting.new(data.token.address, accounts[1], data.start + 100, 120000, 10000, 10000);/* start time is default 100 seconds form now */
    const amountToApprove = ((await data.token.totalSupply()).div(2)).toString();
    const amountToTransfer = ((await data.token.totalSupply()).div(2)).toString();
    await data.token.approve(data.tokenVesting.address, amountToApprove);
    await data.token.approve(data.tokenVesting.address, amountToApprove, { from: accounts[1] });
    await data.token.transfer(accounts[1], amountToTransfer);
    const _owner = (await data.tokenVesting.owner()).toString();
  });

  contract('claimTokens vesting not funded', function () {
    beforeEach(async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
    });

    it('claim tokens will fail if contract not funded', async function () {
      const _now = await latestTime();
      await increaseTimeTo(_now + 150000);

      await data.tokenVesting.claimTokens({ from: accounts[1] }).should.be.rejectedWith(EVMRevert); ;
    });
  });
  contract('claimTokens', function () {
    beforeEach(async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      await data.tokenVesting.fundVesting(allowance, { from: accounts[0] });
    });
    it('claim tokens will fail if called before start time', async function () {
      await data.tokenVesting.claimTokens({ from: accounts[1] }).should.be.rejectedWith(EVMRevert);
    });
    it('claim tokens will success if called by reciver', async function () {
      const _now = await latestTime();

      await increaseTimeTo(_now + 150000);

      await data.tokenVesting.claimTokens({ from: accounts[1] });
    });

    it('claim tokens will fail if called by not reciver', async function () {
      const _now = await latestTime();
      await increaseTimeTo(_now + 150000);

      await data.tokenVesting.claimTokens({ from: accounts[0] }).should.be.rejectedWith(EVMRevert);
    });

    it('claim tokens will release amount proportional to time Passed', async function () {
      const _now = await latestTime();
      await increaseTimeTo(_now + 250000);

      const { logs } = await data.tokenVesting.claimTokens({ from: accounts[1] });

      logs[0].args.tokensClaimed.should.be.bignumber.equal(new BigNumber(60)); // 6 periods 10 each
    });

    it('claim tokens will emit tokens claimed event if succeded', async function () {
      const _now = await latestTime();
      await increaseTimeTo(_now + 150000);

      const { logs } = await data.tokenVesting.claimTokens({ from: accounts[1] });

      logs[0].event.should.equal('TokensClaimed');
    });
  });

  contract('killVesting', function () {
    it('kill vesting will succeed if performed by owner', async function () {
      await data.tokenVesting.killVesting({ from: accounts[0] });// .should.be.rejectedWith(EVMRevert);
    });

    it('kill vesting will fail if performed by not owner', async function () {
      await data.tokenVesting.killVesting({ from: accounts[1] }).should.be.rejectedWith(EVMRevert);
    });

    it('kill vesting if succeed will emit Transfer event with proper sender recipient and value', async function () {
      const retValData = await data.tokenVesting.killVesting({ from: accounts[0] });
      const balanceAfter = await data.token.balanceOf(data.tokenVesting.address);
      return new Promise(function (resolve, reject) {
        data.token.contract.Transfer({ fromBlock: retValData.receipt.blockNumber - 1 }, function (err, result) {
          if (err != null) {
            reject(err);
          } else {
            result.event.should.equal('Transfer');
            balanceAfter.should.be.bignumber.equal(0);
            resolve(true);
          }
        });
      });
    });
  });

  contract('fundVesting', function () {
    it('funding vesting will succeed if performed by owner with sufficent funds and allowence', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      await data.tokenVesting.fundVesting(allowance, { from: accounts[0] });// .should.be.rejectedWith(EVMRevert);
    });

    it('funding vesting will fail if performed by not owner', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      await data.tokenVesting.fundVesting(allowance, { from: accounts[1] }).should.be.rejectedWith(EVMRevert);
    });

    it('funding vesting for amount different than allowence will fail', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).sub(1).toString();
      await data.tokenVesting.fundVesting(allowance, { from: accounts[0] }).should.be.rejectedWith(EVMRevert);
    });

    it('funding vesting will fail if performed by owner without proper balance', async function () {
      const amountToApprove = (await data.token.totalSupply()).toString();
      await data.token.approve(data.tokenVesting.address, amountToApprove);
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      await data.tokenVesting.fundVesting(allowance, { from: accounts[0] }).should.be.rejectedWith(EVMRevert);
    });

    it('funding vesting if succeed will emit VestingFunded event with proper amount', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      const { logs } = await data.tokenVesting.fundVesting(allowance, { from: accounts[0] });// .should.be.rejectedWith(EVMRevert);
      logs[0].event.should.equal('VestingFunded');
      logs[0].args.totalTokens.should.be.bignumber.equal(allowance);
    });

    it('funding vesting if succeed will emit Transfer event with proper sender recipient and value', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      return new Promise(async function (resolve, reject) {
        const retValData = await data.tokenVesting.fundVesting(allowance, { from: accounts[0] });// .should.be.rejectedWith(EVMRevert);
        data.token.contract.Transfer({ fromBlock: retValData.receipt.blockNumber }, function (err, result) {
          if (err != null) {
            reject(err);
          } else {
            result.event.should.equal('Transfer');
            result.args.from.should.equal(accounts[0]);
            result.args.to.should.equal(data.tokenVesting.address);
            resolve(true);
          }
        });
      });
    });
  });
});
