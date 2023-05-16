const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const format = require("date-fns/format");
const isValid = require("date-fns/isValid");

const cors = require("cors");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

let app = express();
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "todoApplication.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000/");
    });
  } catch (error) {
    console.log(`ERROR: ${error.message}`);
  }
};

initializeDbAndServer();

let isValidFunc = (request, response, next) => {};

let authentication = async (request, response, next) => {
  let jwtToken;
  let authorizationTkn = request.headers["authorization"];
  if (authorizationTkn !== undefined) {
    jwtToken = authorizationTkn.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    await jwt.verify(jwtToken, "SECRETE_KEY", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// API 1 GET /todos
app.get("/todos", authentication, async (request, response) => {
  let { search_q = "" } = request.query;
  let sqlQuery = `SELECT * FROM todo WHERE todo LIKE '%${search_q}%';`;

  let todoArr = await db.all(sqlQuery);
  response.send(todoArr);
});

// API 2 Path: /todos/:todoId/

app.get("/todos/:todoId/", authentication, async (request, response) => {
  let { todoId } = request.params;
  let sqlQuery = `SELECT * FROM todo WHERE id = ${todoId};`;
  let res = await db.get(sqlQuery);
  response.send({
    id: res.id,
    todo: res.todo,
    status: res.status,
    dueDate: res.due_date,
    userId: res.user_id,
  });
});

// API 3 POST /todos
app.post("/todos", authentication, async (request, response) => {
  let { username } = request;
  let userIDQuery = `SELECT id FROM user WHERE username = '${username}';`;
  let userId = await db.get(userIDQuery);

  let userNewData = request.body;
  let date = new Date(userNewData.dueDate);

  if (
    userNewData.status !== "PENDING" &&
    userNewData.status !== "IN PROGRESS" &&
    userNewData.status !== "COMPLETED" &&
    userNewData.status !== "DONE"
  ) {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (isValid(date) === false) {
    response.status(400);
    response.send("Invalid Due Date");
  } else {
    let newDate = format(date, "yyyy-MM-dd");
    let sqlQuery = `INSERT INTO 
      todo (id, 
        todo, 
        status, 
        due_date,
        user_id)
      VALUES (${userNewData.id},
        '${userNewData.todo}',
        '${userNewData.status}',
        '${newDate}',
        '${userId.id}');`;

    let postData = await db.run(sqlQuery);
    response.send("Todo Successfully Added");
  }
});

// API  PUT  5 Path: /todos/:todoId/
app.put("/todos/:todoId/", authentication, async (request, response) => {
  let { todoId } = request.params;
  let userContent = request.body;
  let userKey = Object.keys(userContent)[0];

  let hasStatus = () => {
    return userKey === "status";
  };

  let hasPriority = () => {
    return userKey === "priority";
  };

  let hasTodo = () => {
    return userKey === "todo";
  };

  let hasCategory = () => {
    return userKey === "category";
  };

  let hasDueDate = () => {
    return userKey == "dueDate";
    0;
  };
  let userQuery;
  let userResponse;
  switch (true) {
    case hasStatus():
      if (
        userContent.status === "PENDING" ||
        userContent.status === "IN PROGRESS" ||
        userContent.status === "COMPLETED" ||
        userContent.status === "DONE"
      ) {
        userQuery = `UPDATE todo
            SET status = '${userContent.status}'
            WHERE id = ${todoId};`;
        userResponse = "Status Updated";
      } else {
        response.status(400);
        response.send("Invalid Todo Status");
      }
      break;

    case hasPriority():
      if (
        userContent.priority === "HIGH" ||
        userContent.priority === "MEDIUM" ||
        userContent.priority === "LOW"
      ) {
        userQuery = `UPDATE todo
            SET priority = '${userContent.priority}'
            WHERE id = ${todoId};`;
        userResponse = "Priority Updated";
      } else {
        response.status(400);
        response.send("Invalid Todo Priority");
      }

      break;
    case hasTodo():
      userQuery = `UPDATE todo
            SET todo = '${userContent.todo}'
            WHERE id = ${todoId};`;
      userResponse = "Todo Updated";
      break;
    case hasCategory():
      if (
        userContent.category === "WORK" ||
        userContent.category === "HOME" ||
        userContent.category === "LEARNING"
      ) {
        userQuery = `UPDATE todo
            SET category = '${userContent.category}'
            WHERE id = ${todoId};`;
        userResponse = "Category Updated";
      } else {
        response.status(400);
        response.send("Invalid Todo Category");
      }

      break;
    case hasDueDate():
      let d = new Date(userContent.dueDate);
      if (isValid(d)) {
        userQuery = `UPDATE todo
            SET due_date = '${userContent.dueDate}'
            WHERE id = ${todoId};`;
        userResponse = "Due Date Updated";
      } else {
        response.status(400);
        response.send("Invalid Due Date");
      }

      break;
  }

  if (userQuery !== undefined) {
    let updatedData = await db.run(userQuery);
    response.send(userResponse);
  }
});

// API 6 DELETE  Path: /todos/:todoId/

app.delete("/todos/:todoId/", authentication, async (request, response) => {
  let { todoId } = request.params;
  let sqlQuery = `DELETE FROM todo WHERE id = ${todoId};`;
  await db.run(sqlQuery);
  response.send("Todo Deleted");
});

// API 1 POST  Path: /register/

app.post("/register/", async (request, response) => {
  let { username, password, name, gender } = request.body;
  let bcryptKey = await bcrypt.hash(password, 10);
  let sqlRegisterQuery = `SELECT * FROM user WHERE username = '${username}';`;

  let isUserExist = await db.get(sqlRegisterQuery);
  if (isUserExist !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      let sqlRegisterQuery = `INSERT INTO user (name, username, password, gender)
        VALUES ('${name}', '${username}', '${bcryptKey}', '${gender}');`;
      await db.run(sqlRegisterQuery);
      response.send("User created successfully");
    }
  }
});

// API 2 post   Path: /login/

app.post("/login/", async (request, response) => {
  let { username, password } = request.body;
  let isUserExistQuery = `SELECT * FROM user WHERE username = '${username}';`;
  let userExistData = await db.get(isUserExistQuery);
  if (userExistData === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let hasPasswordCorrect = await bcrypt.compare(
      password,
      userExistData.password
    );
    if (hasPasswordCorrect) {
      let payload = {
        username: username,
      };
      let jwtToken = await jwt.sign(payload, "SECRETE_KEY");
      response.send({ jwtToken: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// API 3 Path: /agenda/

app.get("/agenda/", authentication, async (request, response) => {
  let { date } = request.query;
  const d = new Date(date);

  if (isValid(d)) {
    let result = format(d, "yyyy-MM-dd");
    let sqlQuery = `SELECT * FROM todo WHERE due_date LIKE '${result}';`;
    let todoArr = await db.all(sqlQuery);

    let funcObjToSnakeCase = (eachObj) => {
      return {
        id: eachObj.id,
        todo: eachObj.todo,
        priority: eachObj.priority,
        status: eachObj.status,
        category: eachObj.category,
        dueDate: eachObj.due_date,
      };
    };

    let newCamelArr = [];
    for (let eachObj of todoArr) {
      let camelObj = funcObjToSnakeCase(eachObj);
      newCamelArr.push(camelObj);
    }
    response.send(newCamelArr);
  } else {
    response.status(400);
    response.send("Invalid Due Date");
  }
});

module.exports = app;
