import * as functions from "firebase-functions";
import * as dialogflowSdk from "dialogflow";
import * as credentials from "./cred/dialogflow.json";
import {
  dialogflow,
  DialogflowConversation,
  SignIn,
  Carousel,
  Suggestions,
  List
} from "actions-on-google";
import { Boards } from "./boards";
import { Board, BoardData } from "./board";
import { Card } from "./card";
import { Column } from "./column.js";
const app: any = dialogflow({ clientId: "4s0aroxhzpnfj3o44wvk" });

const entitiesClient = new dialogflowSdk.SessionEntityTypesClient({
  credentials: credentials
});

const projectId = "globoards-80562";
type gloItems = "cards" | "card" | "columns" | "cards";

const updateEntity = async (name: string, data: any[], convId: string) => {
  let entities = data.map(element => {
    return {
      value: String(element.id),
      synonyms: [String(element.name)]
    };
  });
  let session: string = `projects/${projectId}/agent/sessions/${convId}`;
  const sessionEntityTypeRequest = {
    parent: session,
    sessionEntityType: {
      name: session + `/entityTypes/${name}`,
      entityOverrideMode: "ENTITY_OVERRIDE_MODE_OVERRIDE",
      entities: entities
    }
  };
  return entitiesClient
    .createSessionEntityType(sessionEntityTypeRequest)
    .then((responses: any) => {
      return responses;
    })
    .catch(error => {
      console.error(error);
    });
};

app.intent(
  "cards-create",
  async (
    conv: DialogflowConversation,
    { cardName, cardDescription }: { cardName: string; cardDescription: string }
  ) => {
    let board: Board;
    let data: BoardData = conv.contexts.get("board").parameters
      .data as BoardData;
    let column = conv.contexts.get("column").parameters.data as Column;
    board = Board.fromData(data);
    if (!board.findColumnById(column.id)) {
      return ask(
        conv,
        `I did not find the ${column.name} in board ${
          board.name
        }. Please try again. `
      );
    }
    let card: Card = await board.createCard(
      cardName,
      column.id,
      cardDescription
    );
    conv.ask(`I have created ${card.name}, what can I do for you next?`);
    conv.contexts.set("card", 3, { data: card });
    return conv.screen
      ? ask(conv, card.getVisualCard())
      : ask(conv, card.getVoiceCard());
  }
);

app.intent(
  "cards-get-by-updated",
  async (
    conv: DialogflowConversation,
    {
      boardId,
      filter,
      columns
    }: { boardId: string; filter: string; columns: string }
  ) => {
    if (filter === "Column" || columns) {
      return conv.followup("event_columns", {});
    }
    let cards: Card[] = [];
    if (boardId) {
      let board: Board = await Board.getBoard(conv["token"], boardId);
      await board.loadCards();
      cards = board.cards;
    } else {
      let boards: Boards = new Boards(conv["token"]);
      await boards.getBoards();
      await boards.loadAllCards();
      for (let board of boards.boards) {
        if (board && board.cards) {
          cards = [...cards, ...board.cards];
        }
      }
    }

    if (cards) {
      cards = cards.filter(
        e => e.updatedAt.getTime() / 1000 + 86400 > new Date().getTime() / 1000
      );
    } else {
      return ask(
        conv,
        `There are no new cards for today, what can I do for you next?`
      );
    }
    //TODO: Add filter by assignee

    let element;
    let contextData = {};
    let items = cards.reduce((obj, item) => {
      element = item;
      obj[item.id] = {
        title: `${element["name"]}`,
        description: `Updated at ${element["updatedAt"].toDateString()}, ${element.description}` 
      };
      contextData[item.id] = item;
      return obj;
    }, {});

    let cardsFilteredObj: cardsFiltered = {
      cards: cards,
      items: items,
      type: 'filtered-cards',
      contextData: contextData
    }
    return replyWithList(conv, cardsFilteredObj, 'Cards', '`There are no new cards for today, what can I do for you next?`', 'Here are the cards updated in last 24 hours. What can I do for you next?', ['Get boards', 'New card', 'New column']);
  }
);

interface cardsFiltered {
  cards: Card[];
  items: any;
  type: string;
  contextData: any;
}

app.intent('board-set-favourite', async (conv: DialogflowConversation, { boardId }: { boardId: string }) => {
  let board: Board;
  if(!boardId && !conv.contexts.get("board")) {
    return ask(conv, `Which board would you like to set as favourite?`); //TODO: Reply with list
  } else if(!boardId && conv.contexts.get("board")) {
    board = conv.contexts.get("board").parameters.data as Board;
  } else {
    board = await Board.getBoard(conv['token'], boardId);
  }
  conv.ask(new Suggestions(['Get boards', 'Get favourite']));
  return ask(conv, `Board ${board.name} set as favourite! What can I do you next?`);
});

app.intent(
  "cards-select",
  async (conv: DialogflowConversation, params, option) => {
    let board: Board;
    let card: Card;
    if(conv.contexts.get("board")) {
      let data: BoardData = conv.contexts.get("board").parameters
      .data as BoardData;
    board = Board.fromData(data);
    await board.loadCards();
    card = board.findCardById(option);
    }
    if(!card && conv.contexts.get("cards")) {
      let items = conv.contexts.get("cards").parameters.data;
      card = items[option]; //TODO: Create context
    }
    
    conv.ask(`Here is the ${card.name}, what can I do for you next?`);
    conv.contexts.set("card", 3, { data: card });
    conv.ask(new Suggestions(['Archive']));
    return conv.screen
      ? ask(conv, card.getVisualCard())
      : ask(conv, card.getVoiceCard());
  }
);

app.intent('columns-create', async (conv: DialogflowConversation, { columnName, boardId }: { columnName: string, boardId: string }) => {
  let board: Board;
  if(!boardId && conv.contexts.get('board')) {
    let data = conv.contexts.get("board").parameters.data as BoardData;
    board = Board.fromData(data);
    // tslint:disable-next-line:no-parameter-reassignment
    boardId = board.id;
  } else if(!boardId && !conv.contexts.get('board')) {
    return ask(conv, `In which board should I create the column?`);
  } else {
    board = await Board.getBoard(conv['token'], boardId);
  }
  let error = await board.createColumn(boardId, columnName);
  if(error) {
    return ask(conv, `Something went wrong, please try again.`);
  }
  
  return ask(conv, `Column ${columnName} in the board ${board.name} created. What can I do for you next?`);


});

app.intent('sign-in-no', (conv: DialogflowConversation) => {
  return conv.close(`Okay, please come back later when you can sign in to continue, bye!`);
});

app.intent('goodbye', (conv: DialogflowConversation) => {
  return conv.close(`Okay, bye for now!`);
});

app.intent(
  "columns-select",
  async (conv: DialogflowConversation, params, option) => {
    let board: Board;
    let data: BoardData = conv.contexts.get("board").parameters
      .data as BoardData;
    board = Board.fromData(data);
    let column = board.findColumnById(option);
    conv.contexts.set("column", 3, { data: column });
    conv.contexts.set("board", 3, { data: board });
    await board.loadCards();

    let boardColumn: boardGetColumn = {
      board: board,
      column: column,
      type: `board-column`
    };
    return replyWithList(
      conv,
      boardColumn,
      `Cards in ${column.name}`,
      `There are no cards in ${column.name}, what can I do for you next?`,
      `Column ${column.name}, here are the cards! What can I do for you next?`,
      ["New card", "Get boards", "New column"]
    );
  }
);

interface boardGetColumn {
  board: Board;
  column: Column;
  type: string;
}

app.intent(
  "cards-get",
  async (conv: DialogflowConversation, { boardId }: { boardId: string }) => {
    let board: Board;

    if (conv.contexts.get("boards") && boardId) {

      let boards = new Boards(
        conv["token"],
        conv.contexts.get("boards").parameters.data
      );
      board = boards.getBoard(boardId);
    } else if (conv.contexts.get("board")) {
      let data: BoardData = conv.contexts.get("board").parameters
        .data as BoardData;
      board = Board.fromData(data);
    } else {
      let boards = new Boards(conv["token"]);
      await boards.getBoards();
      board = boards.boards[0];
    }

    await board.loadCards();
    return replyWithList(conv, board, 'Title', 'There are no cards, what can I do for you next?', `Here are the cards of ${board.name}!`, ['Get boards', 'New card']);
  }
);

function replyWithList(
  conv: DialogflowConversation,
  item: any,
  title: string,
  no_boards: string,
  message: string,
  suggestions: string[] = []
) {
  if (item.length === 0) {
    return ask(conv, no_boards);
  }

  let listData, items;
  if (item.type === "boards") {
    // tslint:disable-next-line:no-parameter-reassignment
    item = item as Boards;
    listData = item.getContextData();
    items = item.getListFormat().items;
    conv.contexts.set('boards', 3, { data: listData });
  } else if (item.type === "board-column") {
    // tslint:disable-next-line:no-parameter-reassignment
    let board = item.board as Board;
    let column = item.column as Column;
    conv.contexts.set("cards", 3, { data: listData});
    items = board.getCardsAsListByColumn(column.id).items;
    listData = board.getContextData();
    if(item.length === 1) {
      conv.ask(`Here is the card, what can I do for you next?`);
      return ask(conv, conv.screen ? item.cards[0].getVisualCard() : items.cards[0].getVoiceCard());
    }
  } else if(item.type === 'filtered-cards') {
    // tslint:disable-next-line:no-parameter-reassignment
    item = item as cardsFiltered;
    items = item.items;
    listData = item.contextData;
    conv.contexts.set('cards', 3, { data: listData });
    if(item.length === 1) {
      conv.ask(`Here is the card, what can I do for you next?`);
      return ask(conv, conv.screen ? item.cards[0].getVisualCard() : items.cards[0].getVoiceCard());
    }
  } else if(item.type === 'board') {
    // tslint:disable-next-line:no-parameter-reassignment
    item = item as Board;
    let board = item;
    items = board.getCardsAsList().items;
    listData = board.getContextData();
    conv.contexts.set("board", 3, { data: board });
    conv.contexts.set("cards", 3, { data: listData });

    if(item.length === 1) {
      conv.ask(`Here is the card, what can I do for you next?`);
      return ask(conv, conv.screen ? item.cards[0].getVisualCard() : items.cards[0].getVoiceCard());
    }
  }
  
  
  if (conv.screen) {
    if (suggestions.length !== 0) {
      conv.ask(new Suggestions(suggestions));
    }
    conv.ask(message);
    console.log(JSON.stringify(items));
    return ask(
      conv,
      new Carousel({
        items: items
      })
    );
  } else {
    return replyWith3Items(conv, item.type, [], listData);
  }

  /* 
      return conv["hasScreen"]
        ? replyWithGroupCard(conv, boards[0])
        : replyWithGroupTextCard(conv, boards[0]);*/
}

let updateEntityBoards = async (
  conv: DialogflowConversation,
  no_boards: string
) => {
  let boards = new Boards(conv.user.access.token);
  await boards.getBoards();
  if (!boards.length || boards.length === 0) {
    return boards;
  }
  let entityResult = await updateEntity("boards", boards, conv.id);
  if (!entityResult) {
    console.error(JSON.stringify(entityResult));
  }
  return boards;
};

function ask(conv: DialogflowConversation, message: any, prompts?: string[]) {
  if (prompts) {
    conv.contexts.set("fallbacks", 3, { fallbacks: [...prompts], number: 0 });
    conv.noInputs = [
      ...prompts,
      `I am sorry, I am not sure how to help. Please come back later, bye!`
    ];
  } else {
    conv.contexts.set("fallbacks", 3, { fallbacks: [], number: 0 });
    conv.noInputs = [];
  }
  let responses = [...conv.responses];
  responses.push(message);
  conv.contexts.set("response", 3, {
    data: responses,
    intent: conv.intent,
    params: conv.parameters
  });
  return conv.ask(message);
}

app.intent("Default Welcome Intent", async (conv: DialogflowConversation) => {
  if (conv.user.access.token) {
    let boards: Boards = await updateEntityBoards(
      conv,
      "Welcome! You have no boards, create one to continue. How can I help you next?"
    );
    return replyWithList(
      conv,
      boards,
      "Boards",
      "Welcome! You have no boards, create one to continue. How can I help you next?",
      "Welcome! Here are you boards, select one to continue.",
      ["Get boards", "Get cards", "Create board", "Create column"]
    );
  } else {
    conv.ask(new Suggestions(['Yes', 'No']));
    return ask(
      conv,
      `Welcome! You need to sign in to manage your boards, can we do that now?`
    );
  }
});

app.intent("sign-in-yes", (conv: DialogflowConversation) => {
  return conv.ask(new SignIn(`To get access to your Glo Boards`));
});

app.intent(
  "boards-select",
  async (
    conv: DialogflowConversation,
    { boardId }: { boardId: string },
    option
  ) => {
    let boards: Boards;
    if (!boardId && !option) {
      boards = await updateEntityBoards(
        conv,
        "Welcome! You have no boards, create one to continue. How can I help you next?"
      );
      return replyWithList(
        conv,
        boards,
        "Boards",
        "You have no boards, create one to continue. How can I help you next?",
        "Here are your boards, please pick one to continue.",
        ["Get boards"]
      );
    }

    let id = boardId || option;
    boards = conv.contexts.get("boards")
      ? new Boards(conv["token"], conv.contexts.get("boards").parameters.data)
      : new Boards(conv["token"]);

    if (boards.isUndefined()) {
      await boards.getBoards();
    }
    let board: Board = boards.getBoard(id);
    if (!board) {
      return ask(conv, `Sorry, something went wrong, please try again`);
    }

    conv.contexts.set("board", 3, { data: board }); //TODO: No screen
    conv.contexts.set("columns", 3, {});
    await updateEntity("columns", board.columns, conv.id);
    let { items } = board.getColumnsAsList();
    conv.ask(new Suggestions(['Get all cards', 'New column']));
    if(board.columns.length > 1) {
      conv.ask(`Here are the columns, pick one to get the cards.`);
      return ask(conv, new List({ title: "Columns", items: items }));
    } else if(board.columns.length === 1) {
      let column = board.columns[0];
      let boardColumn: boardGetColumn = {
        board: board,
        column: column,
        type: `board-column`
      };
      return replyWithList(
        conv,
        boardColumn,
        `The board has only one column ${column.name}, here are the cards. How can I help you next?`,
        `There is only one column ${column.name} in the board and it has no cards, what can I do for you next?`,
        `The board has only one column ${column.name}, here are the cards. How can I help you next?`,
        ["New card", "Get boards", "New column"]
      ); 
    } else {
      return ask(conv, `There are no columns in ${board.name}, try to create one! What can I do for you next?`);    }
    }
);

app.intent(
  "board-create",
  async (
    conv: DialogflowConversation,
    { boardName }: { boardName: string }
  ) => {
    try {
      let board = new Board(conv["token"], null, null, null, null, null);
      board = await board.createBoard(boardName);

      //TODO: Add board context
      return ask(
        conv,
        `I have created a board with a name ${boardName}, what can I do for you next?`
      );
    } catch (error) {
      console.error(error);
      return ask(
        conv,
        `Something went wrong when I tried to create ${boardName}, please try again later, what can I do for you next?`
      );
    }
  }
);

app.middleware((conv: DialogflowConversation) => {
  console.log(`Intent: ${conv.intent}`);
  conv.data["start"] = new Date().getTime();
  conv["hasScreen"] = conv.surface.capabilities.has(
    "actions.capability.SCREEN_OUTPUT"
  );
  conv["hasAudioPlayback"] = conv.surface.capabilities.has(
    "actions.capability.AUDIO_OUTPUT"
  );
  conv["hasBrowser"] = conv.surface.capabilities.has(
    "actions.capability.WEB_BROWSER"
  );
  conv["token"] = conv.user.access.token;
});

app.intent("sign-in-result", (conv: DialogflowConversation, params, signin) => {
  if (signin.status !== "OK") {
    return conv.close(
      `Sign in is needed to authentificate the requests, please come back when you are ready, bye!`
    );
  } else {
    return conv.followup('event_welcome');
  }
});

app.intent("get-boards", async (conv: DialogflowConversation) => {
  try {
    let boards = new Boards(conv["token"]);
    await boards.getBoards();
    return replyWithList(
      conv,
      boards,
      "Boards",
      "You have no boards, create one to continue. How can I help you next?",
      "Here are you boards, select one to continue",
      ["Get boards"]
    );
  } catch (error) {
    console.error(error);
    return conv.ask(error);
  }
});

function replyWith3Items(
  conv: DialogflowConversation,
  type: gloItems,
  prompts: string[] = [],
  data?: any
) {
  let listData = data ? data : conv.contexts.get(type).parameters.data;
  let numberValues = [];
  let text = "";
  if (conv.contexts.get("number-reply")) {
    numberValues = conv.contexts.get("number-reply").parameters.data as any[];
    text = conv.contexts.get("number-reply").parameters.text as string;
  }
  let contextValues = {};
  conv.contexts.delete("number-reply");
  conv.contexts.delete("groups");
  let response: string = "";
  let keys: string[] = [];
  let numberKeys = Object.keys(numberValues);
  for (const key of numberKeys) {
    delete listData[numberValues[key].urlname];
  }
  let listKeys = Object.keys(listData);

  if (listKeys.length > 1) {
    response = `Here are the next ${type}, `;
    if (listKeys.length <= 3) {
      response = `Here are last ${type}, `;
    }

    for (let i = 0; i < 3; i++) {
      let element = listData[Object.keys(listData)[i]];
      contextValues[(i + 1).toString()] = element;
      if (!element) {
        break;
      }
      switch (i) {
        case 0:
          response = response + `first, ${element["name"]}.`;
          break;
        case 1:
          response = response + ` Second, ${element["name"]}.`;
          break;
        case 2:
          response = response + ` Third, ${element["name"]}.`;
          break;
      }
    }
    response = response + `Which ${type} would you like to hear more about?`;
    conv.contexts.set(type, 2, { data: listData });
    conv.contexts.set("number-reply", 2, {
      data: contextValues,
      text: response
    });
    return ask(conv, response, prompts);
  } else if (listKeys.length === 1) {
    delete listData[keys[0]];
    let element = listData[Object.keys(listData)[0]];
    return ask(
      conv,
      `<speak>Here is the last ${type} -  ${
        element["name"]
      }. How can I help you next?</speak>`
    );
  } else {
    conv.contexts.delete(type);
    conv.contexts.set("number-reply", 2, {
      data: contextValues,
      text: response
    });
    conv.ask(`These were the last ${type}: `);
    return ask(conv, text, prompts);
  }
}

export const fulfillment = functions.https.onRequest(app);

/*
export const test = functions.https.onRequest(async (req, res) => {
  try {
    return res.status(200).send();
  } catch (error) {
    console.error(error);
    return res.status(500).send(error);
  }
});*/
