FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml .
RUN --mount=type=secret,id=pip_ca \
    if [ -f /run/secrets/pip_ca ]; then export PIP_CERT=/run/secrets/pip_ca; fi; \
    pip install --no-cache-dir .
RUN useradd --create-home murim
COPY --chown=murim:murim app ./app
USER murim
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
