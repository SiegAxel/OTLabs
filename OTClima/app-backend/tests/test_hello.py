import pytest
from app.services.hello_service import HelloService
from app.models.schemas import HelloResponse


def test_hello_service():
    service = HelloService()
    message = service.get_hello_message("Test")
    assert message == "Hello, Test!"


def test_hello_service_default():
    service = HelloService()
    message = service.get_hello_message("World")
    assert message == "Hello, World!"


def test_hello_response_schema():
    response = HelloResponse(message="Hello, Test!")
    assert response.message == "Hello, Test!"