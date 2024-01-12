// Copyright 2022 Cartesi Pte. Ltd.
//
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

const { ethers } = require("ethers");
// const math = require('mathjs')
var viem = require("viem");
const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

var erc20abi = require("./contract");
var erc721abi = require("./erc721.json");
const erc20_contract_address = viem.getAddress(
  "0x2797a6a6D9D94633BA700b52Ad99337DdaFA3f52"
);
const erc721_contract_address = viem.getAddress(
  "0x68E3Ee84Bcb7543268D361Bb92D3bBB17e90b838"
);

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));
  const payload = data["payload"];
  let advance_req;
  let JSONpayload = {};
  try {
    const payloadStr = ethers.toUtf8String(payload);
    JSONpayload = JSON.parse(payloadStr);
    const solvedCalc = parseInt(payloadStr);
    const randomNumber = Math.floor(Math.random() * 10) + 1;
    console.log(`random number is ${randomNumber}`)

    if (solvedCalc == randomNumber) {
      console.log(`Adding voucher "${solvedCalc}"`);
      const call = viem.encodeFunctionData({
        abi: erc721abi,
        functionName: "mintTo",
        args: [data.metadata.msg_sender],
      });

      let voucher = {
        destination: erc721_contract_address, // dapp Address
        payload: call,
      };

      console.log(voucher);
      advance_req = await fetch(rollup_server + "/voucher", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(voucher),
      });
      console.log("starting a voucher");

    } else {
      console.log(`Adding notice "${solvedCalc}"`);
      advance_req = await fetch(rollup_server + '/notice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ payload })
      });
    }

  } catch (e) {
    console.log(`Adding report with binary value "${payload}"`);
    advance_req = await fetch(rollup_server + '/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ payload })
    });
    return "reject";

  }

  const json = await advance_req.json();
  console.log("Received notice status " + advance_req.status + " with body " + JSON.stringify(json));
  return "accept";
}

async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));
  const payload = data["payload"];
  try {
    const payloadStr = ethers.toUtf8String(payload);
    const solvedCalc = math.evaluate(payloadStr);

    console.log(`Adding notice "${solvedCalc}"`);

  } catch (e) {
    console.log(`Adding report with binary value "${payload}"`);
  }
  const inspect_req = await fetch(rollup_server + '/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ payload })
  });
  console.log("Received report status " + inspect_req.status);
  return "accept";
}

var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
}

var finish = { status: "accept" };

(async () => {
  while (true) {
    console.log("Sending finish")

    const finish_req = await fetch(rollup_server + '/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'accept' })
    });

    console.log("Received finish status " + finish_req.status);


    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);

    }
  }
})();
