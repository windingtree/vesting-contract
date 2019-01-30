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
    data.token = await TokenMock.new(100);
    data.start = (await latestTime()) + duration.days(1);
    /* start time is default 100 seconds form now */
    /* Vesting of 10 periods of 30 days with 30 days cliff */
    data.tokenVesting = await TokenVesting.new(
      data.token.address, accounts[1], data.start, duration.days(30), 10, duration.days(30)
    );
    const amountToApprove = 100;
    await data.token.approve(data.tokenVesting.address, amountToApprove);
    const _owner = (await data.tokenVesting.owner()).toString();
  });

  contract('claimTokens vesting not funded', function () {
    beforeEach(async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
    });

    it('claim tokens will fail if contract not funded', async function () {
      await increaseTimeTo(data.start + 1);

      await data.tokenVesting.claimTokens({ from: accounts[1] }).should.be.rejectedWith(EVMRevert); ;
    });
  });
  contract('claimTokens', function () {
    beforeEach(async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      await data.tokenVesting.fundVesting(allowance);
    });
    it('claim tokens will fail if called before start time', async function () {
      await data.tokenVesting.claimTokens({ from: accounts[1] }).should.be.rejectedWith(EVMRevert);
    });
    it('claim tokens will success if called by reciver', async function () {
      await increaseTimeTo(data.start + duration.days(30) + 1);
      await data.tokenVesting.claimTokens({ from: accounts[1] });
    });

    it('claim tokens will fail if called by not reciver', async function () {
      await increaseTimeTo(data.start + duration.days(30) + 1);
      await data.tokenVesting.claimTokens({ from: accounts[2] }).should.be.rejectedWith(EVMRevert);
    });

    it('claim tokens will release amount proportional to time passed', async function () {
      await increaseTimeTo(data.start + duration.days(30)*3 + 1);
      (await data.tokenVesting.claimTokens({ from: accounts[1] }))
        .logs[0].args.tokensClaimed.should.be.bignumber.equal(new BigNumber(20)); // 2 periods

      await increaseTimeTo(data.start + duration.days(30)*9 + 1);
      (await data.tokenVesting.claimTokens({ from: accounts[1] }))
        .logs[0].args.tokensClaimed.should.be.bignumber.equal(new BigNumber(60)); // 8 periods

      await increaseTimeTo(data.start + duration.days(30)*11 + 1);
      (await data.tokenVesting.claimTokens({ from: accounts[1] }))
        .logs[0].args.tokensClaimed.should.be.bignumber.equal(new BigNumber(20)); // 10 periods

      (await data.token.balanceOf(accounts[1])).should.be.bignumber.equal(new BigNumber(100));
    });

    it('claim tokens will release amount to a new receiver', async function () {
      await increaseTimeTo(data.start + duration.days(30)*3 + 1);
      (await data.tokenVesting.claimTokens({ from: accounts[1] }))
        .logs[0].args.tokensClaimed.should.be.bignumber.equal(new BigNumber(20)); // 2 periods

      await data.tokenVesting.changeReceiver(accounts[3]);

      await increaseTimeTo(data.start + duration.days(30)*9 + 1);
      (await data.tokenVesting.claimTokens({ from: accounts[3] }))
        .logs[0].args.tokensClaimed.should.be.bignumber.equal(new BigNumber(60)); // 8 periods

      await increaseTimeTo(data.start + duration.days(30)*11 + 1);
      (await data.tokenVesting.claimTokens({ from: accounts[3] }))
        .logs[0].args.tokensClaimed.should.be.bignumber.equal(new BigNumber(20)); // 10 periods

      (await data.token.balanceOf(accounts[1])).should.be.bignumber.equal(new BigNumber(20));
      (await data.token.balanceOf(accounts[3])).should.be.bignumber.equal(new BigNumber(80));
    });

    it('claim tokens will emit tokens claimed event if succeded', async function () {
      await increaseTimeTo(data.start + duration.days(30)*11 + 1);
      (await data.tokenVesting.claimTokens({ from: accounts[1] }))
        .logs[0].event.should.equal('TokensClaimed');

      (await data.token.balanceOf(accounts[1])).should.be.bignumber.equal(new BigNumber(100));
    });
  });

  contract('killVesting', function () {
    it('kill vesting will succeed if performed by owner', async function () {
      await data.tokenVesting.killVesting({ from: accounts[0] });
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
      await data.tokenVesting.fundVesting(allowance);
    });

    it('funding vesting will fail if performed by not owner', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      await data.tokenVesting.fundVesting(allowance, { from: accounts[1] }).should.be.rejectedWith(EVMRevert);
    });

    it('funding vesting for amount different than allowence will fail', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).sub(1).toString();
      await data.tokenVesting.fundVesting(allowance).should.be.rejectedWith(EVMRevert);
    });

    it('funding vesting will fail if performed by owner without proper balance', async function () {
      await data.token.approve(data.tokenVesting.address, 110);
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      await data.tokenVesting.fundVesting(allowance).should.be.rejectedWith(EVMRevert);
    });

    it('funding vesting if succeed will emit VestingFunded event with proper amount', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      const { logs } = await data.tokenVesting.fundVesting(allowance);
      logs[0].event.should.equal('VestingFunded');
      logs[0].args.totalTokens.should.be.bignumber.equal(allowance);
    });

    it('funding vesting if succeed will emit Transfer event with proper sender recipient and value', async function () {
      const allowance = (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
      return new Promise(async function (resolve, reject) {
        const retValData = await data.tokenVesting.fundVesting(allowance);
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
