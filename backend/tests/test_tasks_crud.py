from datetime import datetime, timezone, timedelta
from app.models import User


def get_test_user_id(client):
    res = client.get("/api/v1/users/me")
    assert res.status_code == 200
    return res.json()["id"]


def test_create_task(client):
    user_id = get_test_user_id(client)
    due_iso = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()

    payload = {
        "user_id": user_id,
        "title": "Buy groceries",
        "description": "Milk, eggs, and bread",
        "due_at_utc": due_iso,
        "priority": "high",
        "category": "Personal",
        "estimated_minutes": 30,
        "remind_at_utc": due_iso,
    }
    response = client.post("/api/v1/tasks/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Buy groceries"
    assert data["priority"] == "high"
    assert data["category"] == "Personal"
    assert data["status"] == "pending"
    assert data["estimated_minutes"] == 30
    assert data["id"] is not None


def test_get_task_detail_with_events_and_reminders(client):
    user_id = get_test_user_id(client)
    due_iso = (datetime.now(timezone.utc) + timedelta(hours=5)).isoformat()

    create_res = client.post(
        "/api/v1/tasks/",
        json={
            "user_id": user_id,
            "title": "Doctor appointment",
            "due_at_utc": due_iso,
            "priority": "high",
        },
    )
    task_id = create_res.json()["id"]

    get_res = client.get(f"/api/v1/tasks/{task_id}")
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["id"] == task_id
    assert len(detail["events"]) >= 1
    assert detail["events"][0]["event"] == "created"
    assert len(detail["reminders"]) >= 1


def test_update_task(client):
    user_id = get_test_user_id(client)
    create_res = client.post(
        "/api/v1/tasks/",
        json={"user_id": user_id, "title": "Initial Title", "priority": "low"},
    )
    task_id = create_res.json()["id"]

    update_res = client.put(
        f"/api/v1/tasks/{task_id}",
        json={"title": "Updated Title", "priority": "high", "estimated_minutes": 60},
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["title"] == "Updated Title"
    assert updated["priority"] == "high"
    assert updated["estimated_minutes"] == 60

    # Verify event logged
    get_res = client.get(f"/api/v1/tasks/{task_id}")
    events = [e["event"] for e in get_res.json()["events"]]
    assert "updated" in events


def test_complete_task(client):
    user_id = get_test_user_id(client)
    create_res = client.post(
        "/api/v1/tasks/",
        json={"user_id": user_id, "title": "Complete me", "priority": "med"},
    )
    task_id = create_res.json()["id"]

    complete_res = client.post(f"/api/v1/tasks/{task_id}/complete")
    assert complete_res.status_code == 200
    completed = complete_res.json()
    assert completed["status"] == "done"
    assert completed["completed_at"] is not None


def test_snooze_task(client):
    user_id = get_test_user_id(client)
    create_res = client.post(
        "/api/v1/tasks/",
        json={"user_id": user_id, "title": "Snooze me"},
    )
    task_id = create_res.json()["id"]

    # Snooze by 120 minutes
    snooze_res = client.post(
        f"/api/v1/tasks/{task_id}/snooze",
        json={"snooze_minutes": 120},
    )
    assert snooze_res.status_code == 200
    snoozed = snooze_res.json()
    assert snoozed["status"] == "snoozed"
    assert snoozed["due_at_utc"] is not None

    # Snooze with exact timestamp
    target_time = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
    snooze_exact_res = client.post(
        f"/api/v1/tasks/{task_id}/snooze",
        json={"snooze_until": target_time},
    )
    assert snooze_exact_res.status_code == 200
    assert snooze_exact_res.json()["status"] == "snoozed"


def test_delete_task(client):
    user_id = get_test_user_id(client)
    create_res = client.post(
        "/api/v1/tasks/",
        json={"user_id": user_id, "title": "Delete me soon"},
    )
    task_id = create_res.json()["id"]

    del_res = client.delete(f"/api/v1/tasks/{task_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    get_res = client.get(f"/api/v1/tasks/{task_id}")
    assert get_res.status_code == 404


def test_list_tasks_filtering_and_search(client):
    user_id = get_test_user_id(client)
    now = datetime.now(timezone.utc)

    # Seed 3 different tasks
    client.post(
        "/api/v1/tasks/",
        json={
            "user_id": user_id,
            "title": "Gym workout session",
            "category": "Fitness",
            "priority": "med",
            "due_at_utc": (now + timedelta(days=1)).isoformat(),
        },
    )
    client.post(
        "/api/v1/tasks/",
        json={
            "user_id": user_id,
            "title": "Review client proposal",
            "category": "Work",
            "priority": "high",
            "due_at_utc": (now + timedelta(days=2)).isoformat(),
        },
    )
    client.post(
        "/api/v1/tasks/",
        json={
            "user_id": user_id,
            "title": "Clean kitchen pantry",
            "category": "Home",
            "priority": "low",
            "due_at_utc": (now + timedelta(days=7)).isoformat(),
        },
    )

    # Test category filter
    res_work = client.get("/api/v1/tasks/?category=Work")
    assert res_work.status_code == 200
    assert res_work.json()["total"] == 1
    assert res_work.json()["items"][0]["title"] == "Review client proposal"

    # Test priority filter
    res_high = client.get("/api/v1/tasks/?priority=high")
    assert res_high.status_code == 200
    assert res_high.json()["total"] == 1
    assert res_high.json()["items"][0]["title"] == "Review client proposal"

    # Test search filter
    res_search = client.get("/api/v1/tasks/?search=workout")
    assert res_search.status_code == 200
    assert res_search.json()["total"] == 1
    assert res_search.json()["items"][0]["title"] == "Gym workout session"

    # Test date range filter (due in next 3 days)
    before_date = (now + timedelta(days=3)).isoformat()
    res_date = client.get(f"/api/v1/tasks/?due_before={before_date}")
    assert res_date.status_code == 200
    assert res_date.json()["total"] == 2

    # Test pagination
    res_page = client.get("/api/v1/tasks/?limit=2&offset=0")
    assert res_page.status_code == 200
    assert len(res_page.json()["items"]) == 2
    assert res_page.json()["total"] == 3


def test_task_summary(client):
    user_id = get_test_user_id(client)
    now = datetime.now(timezone.utc)

    # 1 Overdue task
    client.post(
        "/api/v1/tasks/",
        json={
            "user_id": user_id,
            "title": "Past task",
            "priority": "high",
            "due_at_utc": (now - timedelta(days=1)).isoformat(),
        },
    )
    # 1 Done task
    res_done = client.post(
        "/api/v1/tasks/",
        json={"user_id": user_id, "title": "Completed task"},
    )
    client.post(f"/api/v1/tasks/{res_done.json()['id']}/complete")

    summary_res = client.get("/api/v1/tasks/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total"] == 2
    assert summary["done"] == 1
    assert summary["pending"] == 1
    assert summary["overdue"] == 1
    assert summary["high_priority"] == 1


def test_not_found_endpoints(client):
    assert client.get("/api/v1/tasks/99999").status_code == 404
    assert client.put("/api/v1/tasks/99999", json={"title": "New"}).status_code == 404
    assert client.post("/api/v1/tasks/99999/complete").status_code == 404
    assert client.post("/api/v1/tasks/99999/snooze", json={}).status_code == 404
    assert client.delete("/api/v1/tasks/99999").status_code == 404
