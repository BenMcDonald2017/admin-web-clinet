import ware from 'warewolf';
// import fetch from 'node-fetch';
import { before, after } from '../../utils';
import { invokeLambda } from '../../resources';

export const create = ware(
  before,

  async (event) => {
    console.dir(event);

    invokeLambda({
      nameArg: 'functionNameHere', // function name?
      payload: {

      },
      setStage: true,
    });
  },

  //   async (event) => {
  //     // const { something } = event.query;
  //     const url = 'https://docusign/api/here';

  //     await fetch(`${url}`, {
  //       headers: {
  //         Accept: 'text/plain',
  //         'Content-type': 'application/json',
  //       },
  //       method: 'GET',
  //     })
  //       .then(response => response.json())
  //       .then((result) => {
  //         event.result = formatResult(result);
  //       })
  //       .catch((error) => {
  //         event.error = error;
  //         // event.error = new Error(error);
  //       });
  //   },

  after,
);

// const formatResult = input => ({
//   input,
// });
