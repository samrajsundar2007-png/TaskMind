from datetime import datetime, timezone


def test_chat_add_task_flow(client):
    payload = {
        "message": "Add task to submit research report tomorrow at 4pm priority high category Work",
        "session_id": "test_session_1",
    }
    res = client.post("/api/v1/chat/", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "research report" in data["reply"].lower() or "created task" in data["reply"].lower()
    assert len(data["tool_calls"]) == 1
    assert data["tool_calls"][0]["name"] == "add_task"

    # Verify task was actually inserted in DB
    tasks_res = client.get("/api/v1/tasks/")
    assert tasks_res.status_code == 200
    assert tasks_res.json()["total"] == 1
    task = tasks_res.json()["items"][0]
    assert "research report" in task["title"].lower()
    assert task["priority"] == "high"
    assert task["category"] == "Work"


def test_chat_multi_turn_flow(client):
    session_id = "multi_turn_session"

    # Turn 1: Add task
    res1 = client.post("/api/v1/chat/", json={"message": "Add task Call Accountant", "session_id": session_id})
    assert res1.status_code == 200
    task_id = res1.json()["tool_calls"][0]["result"]["data"]["task_id"]

    # Turn 2: Complete task
    res2 = client.post("/api/v1/chat/", json={"message": f"Complete task {task_id}", "session_id": session_id})
    assert res2.status_code == 200
    assert "completed" in res2.json()["reply"].lower()

    # Turn 3: Unconfirmed Delete
    res3 = client.post("/api/v1/chat/", json={"message": f"Delete task {task_id}", "session_id": session_id})
    assert res3.status_code == 200
    assert res3.json()["requires_confirmation"] is True
    assert "sure you want to delete" in res3.json()["reply"].lower()

    # Turn 4: Confirmed Delete
    res4 = client.post("/api/v1/chat/", json={"message": f"Yes, confirm delete task {task_id}", "session_id": session_id})
    assert res4.status_code == 200
    assert "deleted" in res4.json()["reply"].lower()

    # Verify task is deleted
    get_res = client.get(f"/api/v1/tasks/{task_id}")
    assert get_res.status_code == 404


def test_chat_ambiguous_date_question(client):
    res = client.post("/api/v1/chat/", json={"message": "Remind me to clean the attic sometime later"})
    assert res.status_code == 200
    data = res.json()
    assert len(data["tool_calls"]) == 0
    assert "?" in data["reply"]
